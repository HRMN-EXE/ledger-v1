package expo.modules.ledgeralarm

import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build

/**
 * The moment an alarm is due. From here the alert exists entirely in native
 * code: notification, sound service, and — when Android lets us — a
 * full-screen take-over. JS does not need to be running for any of it.
 */
class AlarmReceiver : BroadcastReceiver() {

  companion object {
    const val ACTION_FIRE = "expo.modules.ledgeralarm.FIRE"
    const val EXTRA_PLAN = "plan"

    fun canUseFullScreen(context: Context): Boolean {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return true
      val manager = context.getSystemService(NotificationManager::class.java) ?: return true
      return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
        manager.canUseFullScreenIntent()
      } else {
        true
      }
    }
  }

  override fun onReceive(context: Context, intent: Intent) {
    val plan = AlarmPlan.decode(intent.getStringExtra(EXTRA_PLAN)) ?: return
    val app = context.applicationContext
    LedgerNotifications.ensureChannels(app)
    AlarmStore.markFired(app, plan)

    if (plan.isAlarm) {
      AlarmStore.setRinging(app, plan)
      val fullScreen = canUseFullScreen(app)
      val manager = app.getSystemService(NotificationManager::class.java)
      val notification = LedgerNotifications.build(app, plan, fullScreen)
      runCatching { manager?.notify(LedgerNotifications.NOTIFICATION_ID_RING, notification) }

      RingService.start(app, plan)

      if (fullScreen) {
        runCatching {
          app.startActivity(
            Intent(app, RingActivity::class.java).apply {
              addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
              putExtra(EXTRA_PLAN, plan.encode())
            }
          )
        }
      }
    } else {
      val manager = app.getSystemService(NotificationManager::class.java)
      runCatching { manager?.notify(LedgerNotifications.notifyId(plan), LedgerNotifications.build(app, plan, false)) }
    }

    LedgerAlarmBus.emit(
      "onAlarmFired",
      mapOf(
        "key" to plan.key,
        "kind" to plan.kind,
        "title" to plan.title,
        "body" to plan.body,
        "taskId" to plan.taskId,
        "ritualId" to plan.ritualId,
        "priority" to plan.priority,
        "firedAt" to System.currentTimeMillis()
      )
    )
  }
}
