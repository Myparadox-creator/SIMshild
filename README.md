# SIMShield Android prototype

This is a native Android app project. It provides persistent local monitoring preferences and safe simulated high-risk/normal events. The high-risk test sends an Android notification (after notification permission is granted).

## Install

Open `SIMShieldAndroid` in Android Studio, let Gradle sync, then select your Android phone and press Run. On Android 13+, approve the notification permission.

This app cannot embed itself in Android's system Settings app and does not independently access banking accounts or confirm a remote SIM swap. Production detection needs consented integrations with a mobile operator and participating financial providers.
