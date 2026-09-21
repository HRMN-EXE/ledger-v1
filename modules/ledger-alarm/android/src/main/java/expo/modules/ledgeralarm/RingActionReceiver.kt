package expo.modules.ledgeralarm

import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Done / Snooze / Stop from a notification button, while the app may be
 * closed. The decision is written to the outbox so JS can apply it to the
 * database the next time Ledger runs.
 */
class RingActionReceiver : BroadcastReceiver() {

  companion object {
    const val ACTION_DONE = "expo.modules.ledgeralarm.ACTION_DONE"
    const val ACTION_SNOOZE = "expo.modules.ledgeralarm.ACTION_SNOOZE"
    const val ACTION_STOP = "expo.modules.ledgeralarm.ACTION_STOP"

    const val SNOOZE_MINUTES_ALARM = 10L
    const val SNOOZE_MINUTES_SOFT = 5L

    /** Returns the outbox action name handed to JS. */
    fun handle(context: Context, plan: AlarmPlan, action: String): String {
      val app = context.applicationContext
      val outboxAction = when (action) {
        ACTION_SNOOZE -> "snooze"
        ACTION_DONE -> "done"
        else -> "stop"
      }

      AlarmStore.pushAction(app, plan, outboxAction, "notification")

      if (outboxAction == "snooze") {
        val minutes = if (plan.isAlarm) SNOOZE_MINUTES_ALARM else SNOOZE_MINUTES_SOFT
        val next = plan.copy(
          key = "${LedgerAlarmScheduler.SNOOZE_PREFIX}${plan.key}:${System.currentTimeMillis()}",
          fireAt = System.currentTimeMillis() + minutes * 60_000
        )
        LedgerAlarmScheduler.schedule(app, next)
        AlarmStore.saveArmed(app, AlarmStore.armed(app) + next)
      }

      RingService.stop(app)
      runCatching {
        val manager = app.getSystemService(NotificationManager::class.java)
        manager?.cancel(LedgerNotifications.NOTIFICATION_ID_RING)
        manager?.cancel(LedgerNotifications.notifyId(plan))
      }

      LedgerAlarmBus.emit(
        "onAlarmAction",
        mapOf(
          "action" to outboxAction,
          "key" to plan.key,
          "kind" to plan.kind,
          "title" to plan.title,
          "body" to plan.body,
          "taskId" to plan.taskId,
          "ritualId" to plan.ritualId,
          "day" to plan.day,
          "at" to System.currentTimeMillis()
        )
      )

      return outboxAction
    }
  }

  override fun onReceive(context: Context, intent: Intent) {
    val plan = AlarmPlan.decode(intent.getStringExtra(AlarmReceiver.EXTRA_PLAN)) ?: return
    val action = intent.action ?: ACTION_STOP
    handle(context.applicationContext, plan, action)
  }
}
