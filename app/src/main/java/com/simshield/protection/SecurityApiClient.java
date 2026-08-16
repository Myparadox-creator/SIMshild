package com.simshield.protection;

import android.os.Handler;
import android.os.Looper;
import org.json.JSONObject;
import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/** Thin client only: authoritative scoring and mitigation decisions remain on the backend. */
final class SecurityApiClient {
  interface Callback { void success(RiskResult result); void failure(String safeMessage); }
  static final class RiskResult { final int score; final String level; final String alertTitle; final boolean simulation;
    RiskResult(int score,String level,String alertTitle,boolean simulation){this.score=score;this.level=level;this.alertTitle=alertTitle;this.simulation=simulation;} }
  private final String baseUrl; private final Handler main=new Handler(Looper.getMainLooper());
  SecurityApiClient(String baseUrl){this.baseUrl=baseUrl==null?"":baseUrl.replaceAll("/$","");}
  boolean configured(){return !baseUrl.isEmpty();}
  void simulate(String userId,String scenario,Callback callback){
    if(!configured()){callback.failure("Backend not configured; showing offline simulation only.");return;}
    new Thread(()->{HttpURLConnection c=null;try{c=(HttpURLConnection)new URL(baseUrl+"/api/simulation/"+scenario).openConnection();c.setRequestMethod("POST");c.setConnectTimeout(5000);c.setReadTimeout(5000);c.setRequestProperty("content-type","application/json");c.setDoOutput(true);try(OutputStream out=c.getOutputStream()){out.write(new JSONObject().put("userId",userId).toString().getBytes(StandardCharsets.UTF_8));}if(c.getResponseCode()/100!=2)throw new IOException("Service unavailable");String raw;try(InputStream in=c.getInputStream()){raw=readUtf8(in);}JSONObject root=new JSONObject(raw),risk=root.getJSONObject("risk"),alert=root.optJSONObject("alert");RiskResult r=new RiskResult(risk.getInt("riskScore"),risk.getString("riskLevel"),alert==null?"":alert.optString("title"),root.optBoolean("simulation",true));main.post(()->callback.success(r));}catch(Exception ignored){main.post(()->callback.failure("Security service unavailable. No account action was taken."));}finally{if(c!=null)c.disconnect();}}).start();
  }
  private static String readUtf8(InputStream in)throws IOException{ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] b=new byte[1024];for(int n;(n=in.read(b))!=-1;)out.write(b,0,n);return out.toString("UTF-8");}
}
