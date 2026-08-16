import { createHash, randomUUID } from 'node:crypto';

export const EventType = Object.freeze({
  SIM_CHANGED: 'SIM_CHANGED', SIM_REPLACED: 'SIM_REPLACED', SIM_ACTIVATED: 'SIM_ACTIVATED',
  SIM_DEACTIVATED: 'SIM_DEACTIVATED', ESIM_ADDED: 'ESIM_ADDED', ESIM_REMOVED: 'ESIM_REMOVED',
  ESIM_ACTIVATED: 'ESIM_ACTIVATED', ESIM_CHANGED: 'ESIM_CHANGED', NUMBER_PORTED: 'NUMBER_PORTED',
  CARRIER_CHANGED: 'CARRIER_CHANGED', DEVICE_CHANGED: 'DEVICE_CHANGED', NEW_DEVICE_LOGIN: 'NEW_DEVICE_LOGIN',
  PASSWORD_RESET: 'PASSWORD_RESET', PIN_RESET: 'PIN_RESET', NEW_BENEFICIARY: 'NEW_BENEFICIARY',
  UNUSUAL_TRANSACTION: 'UNUSUAL_TRANSACTION', FAILED_AUTH_ATTEMPTS: 'FAILED_AUTH_ATTEMPTS', UNUSUAL_LOCATION: 'UNUSUAL_LOCATION'
});
export const Source = Object.freeze({ DEVICE:'DEVICE', BACKEND:'BACKEND', CARRIER:'CARRIER', MOCK_CARRIER:'MOCK_CARRIER', AUTH_SERVICE:'AUTH_SERVICE' });
export const RiskLevel = Object.freeze({ LOW:'LOW', MEDIUM:'MEDIUM', HIGH:'HIGH', CRITICAL:'CRITICAL' });

const MOBILE_IDENTITY = new Set([EventType.SIM_CHANGED,EventType.SIM_REPLACED,EventType.SIM_ACTIVATED,EventType.SIM_DEACTIVATED,EventType.ESIM_ADDED,EventType.ESIM_REMOVED,EventType.ESIM_ACTIVATED,EventType.ESIM_CHANGED,EventType.NUMBER_PORTED,EventType.CARRIER_CHANGED]);
export const DEFAULT_RULES = Object.freeze({ correlationWindowMs: 24*60*60*1000, maxScore:100, weights: Object.freeze({
  [EventType.SIM_CHANGED]:30,[EventType.SIM_REPLACED]:30,[EventType.ESIM_CHANGED]:30,[EventType.ESIM_ADDED]:30,[EventType.NUMBER_PORTED]:25,[EventType.CARRIER_CHANGED]:20,
  [EventType.NEW_DEVICE_LOGIN]:20,[EventType.DEVICE_CHANGED]:20,[EventType.UNUSUAL_LOCATION]:10,[EventType.PASSWORD_RESET]:15,[EventType.PIN_RESET]:15,
  [EventType.NEW_BENEFICIARY]:15,[EventType.UNUSUAL_TRANSACTION]:20,[EventType.FAILED_AUTH_ATTEMPTS]:10
})});
const reasonFor = { SIM_CHANGED:'RECENT_SIM_CHANGE',SIM_REPLACED:'RECENT_SIM_CHANGE',ESIM_CHANGED:'RECENT_ESIM_CHANGE',ESIM_ADDED:'RECENT_ESIM_CHANGE',NUMBER_PORTED:'NUMBER_PORTED',CARRIER_CHANGED:'CARRIER_CHANGED',NEW_DEVICE_LOGIN:'NEW_DEVICE',DEVICE_CHANGED:'UNKNOWN_DEVICE',UNUSUAL_LOCATION:'UNUSUAL_LOCATION',PASSWORD_RESET:'PASSWORD_RESET',PIN_RESET:'PIN_RESET',NEW_BENEFICIARY:'NEW_BENEFICIARY',UNUSUAL_TRANSACTION:'ABNORMAL_TRANSACTION',FAILED_AUTH_ATTEMPTS:'FAILED_AUTH_ATTEMPTS' };
export function hashIdentifier(value) { return createHash('sha256').update(String(value)).digest('hex'); }
export function validateEvent(input) {
  if (!input || typeof input !== 'object' || !input.userId || !Object.values(EventType).includes(input.eventType) || !Object.values(Source).includes(input.source)) throw new Error('Invalid mobile identity event');
  return Object.freeze({ eventId: input.eventId ?? randomUUID(), userId:String(input.userId), eventType:input.eventType, source:input.source, platform:input.platform ?? 'ANDROID', timestamp:input.timestamp ?? new Date().toISOString(), carrier:input.carrier ?? null, previousCarrier:input.previousCarrier ?? null, simType:input.simType ?? null, previousSimType:input.previousSimType ?? null, deviceIdHash:input.deviceIdHash ?? null, previousDeviceIdHash:input.previousDeviceIdHash ?? null, ipAddressHash:input.ipAddressHash ?? null, country:input.country ?? null, riskRelevant:input.riskRelevant !== false, metadata:input.metadata ?? {}, verified:input.verified === true, simulation:input.simulation === true });
}
export class RuleBasedRiskEngine {
  constructor(rules=DEFAULT_RULES) { this.rules=rules; }
  calculateRisk(events, now=Date.now()) {
    const recent=events.filter(e => e.riskRelevant && now-Date.parse(e.timestamp) <= this.rules.correlationWindowMs);
    const mobile=recent.filter(e=>MOBILE_IDENTITY.has(e.eventType));
    // Weak signals are deliberately not sufficient: identity change plus another suspicious action is required for HIGH.
    let score=0; const reasons=new Set(); const ids=[];
    for (const e of recent) { const weight=this.rules.weights[e.eventType] ?? 0; if(weight){ score+=weight; reasons.add(reasonFor[e.eventType]); ids.push(e.eventId); } }
    if (mobile.length && recent.some(e=>[EventType.NEW_DEVICE_LOGIN,EventType.DEVICE_CHANGED].includes(e.eventType))) reasons.add('ACCOUNT_TAKEOVER_PATTERN');
    score=Math.min(this.rules.maxScore,score);
    let riskLevel=score>=80?RiskLevel.CRITICAL:score>=50?RiskLevel.HIGH:score>=30?RiskLevel.MEDIUM:RiskLevel.LOW;
    if (mobile.length===0 && score<50) riskLevel=score>=30?RiskLevel.MEDIUM:RiskLevel.LOW;
    return { riskScore:score,riskLevel,reasonCodes:[...reasons],relatedEventIds:ids,correlationWindowEndsAt:new Date(now+this.rules.correlationWindowMs).toISOString() };
  }
}
export class InMemoryRiskRepository {
  constructor(engine=new RuleBasedRiskEngine()) { this.engine=engine; this.events=[]; this.alerts=[]; this.cases=[]; }
  ingest(raw) { const event=validateEvent(raw); this.events.push(event); const userEvents=this.events.filter(e=>e.userId===event.userId); const risk=this.engine.calculateRisk(userEvents); const alert=this.createAlert(event.userId,risk,event); return { event,risk,alert }; }
  createAlert(userId,risk,event) { if(risk.riskLevel===RiskLevel.LOW) return null; const severity=risk.riskLevel==='MEDIUM'?'WARNING':risk.riskLevel; const title=severity==='CRITICAL'?'Potential account takeover detected':severity==='HIGH'?'Suspicious account activity detected':'Recent SIM/eSIM change detected'; const simulation=event.simulation; const alert={alertId:randomUUID(),userId,severity,riskScore:risk.riskScore,alertType:'MOBILE_IDENTITY_RISK',title,message: simulation ? `${title} (Simulation)` : title,triggeredAt:new Date().toISOString(),status:'OPEN',reasons:risk.reasonCodes,relatedEventIds:risk.relatedEventIds,transactionId:event.metadata.transactionId ?? null,resolvedAt:null,resolvedBy:null,simulation}; this.alerts.push(alert); if(severity==='CRITICAL') this.cases.push({caseId:randomUUID(),userId,alertId:alert.alertId,status:'OPEN',createdAt:alert.triggeredAt,simulation}); return alert; }
  riskFor(userId) { return this.engine.calculateRisk(this.events.filter(e=>e.userId===userId)); }
  securityEvents(userId) { return this.events.filter(e=>e.userId===userId).sort((a,b)=>Date.parse(b.timestamp)-Date.parse(a.timestamp)); }
  alertsFor(userId) { return this.alerts.filter(a=>a.userId===userId); }
  resolveAlert(alertId,action) { const a=this.alerts.find(x=>x.alertId===alertId); if(!a) return null; a.status=action==='report'?'REPORTED':'ACKNOWLEDGED';a.resolvedAt=new Date().toISOString();return a; }
}
export class MockCarrierEventProvider { emit(userId,eventType=EventType.SIM_CHANGED){ return {userId,eventType,source:Source.MOCK_CARRIER,platform:'ANDROID',timestamp:new Date().toISOString(),simType:eventType.startsWith('ESIM')?'ESIM':'PHYSICAL_SIM',riskRelevant:true,verified:false,simulation:true,metadata:{provider:'mock-carrier',label:'Simulation'}}; } }
