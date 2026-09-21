package expo.modules.ledgeralarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * A reboot wipes AlarmManager. Every armed alarm is written to disk precisely
 * so this receiver can put them all back — no app launch required.
 */
class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    when (intent.action) {
      Intent.ACTION_BOOT_COMPLETED,
      Intent.ACTION_MY_PACKAGE_REPLACED,
      Intent.ACTION_TIME_CHANGED,
      Intent.ACTION_TIMEZONE_CHANGED,
      "android.intent.action.QUICKBOOT_POWERON" -> {
        val app = context.applicationContext
        LedgerNotifications.ensureChannels(app)
        LedgerAlarmScheduler.rearmAfterBoot(app)
      }
    }
  }
}
