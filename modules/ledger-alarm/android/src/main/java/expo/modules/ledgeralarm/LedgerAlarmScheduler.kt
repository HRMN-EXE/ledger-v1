package expo.modules.ledgeralarm

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build

/**
 * All the AlarmManager knowledge in one place.
 *
 * `setAlarmClock` is deliberate: it is the API real clock apps use. It is
 * exact, it survives Doze, it shows the little alarm icon in the status bar,
 * and it is the only alarm type the system treats as user-visible.
 */
object LedgerAlarmScheduler {

  private const val REQUEST_OFFSET = 0x1ED00000

  /** Snoozes created natively (notification button) start with this. */
  const val SNOOZE_PREFIX = "snooze:"

  private fun requestCode(key: String): Int = REQUEST_OFFSET + (key.hashCode() and 0x000FFFFF)

  private fun alarmIntent(context: Context, plan: AlarmPlan): Intent =
    Intent(context, AlarmReceiver::class.java).apply {
      action = AlarmReceiver.ACTION_FIRE
      putExtra(AlarmReceiver.EXTRA_PLAN, plan.encode())
    }

  fun pendingIntent(context: Context, plan: AlarmPlan): PendingIntent =
    PendingIntent.getBroadcast(
      context,
      requestCode(plan.key),
      alarmIntent(context, plan),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

  private fun showIntent(context: Context, plan: AlarmPlan): PendingIntent =
    PendingIntent.getActivity(
      context,
      requestCode(plan.key),
      Intent(context, RingActivity::class.java).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        putExtra(AlarmReceiver.EXTRA_PLAN, plan.encode())
      },
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

  fun canScheduleExact(context: Context): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true
    val manager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return false
    return manager.canScheduleExactAlarms()
  }

  fun schedule(context: Context, plan: AlarmPlan): Boolean {
    val manager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return false
    val pending = pendingIntent(context, plan)
    val at = if (plan.fireAt <= System.currentTimeMillis()) System.currentTimeMillis() + 1000 else plan.fireAt

    return try {
      if (canScheduleExact(context)) {
        manager.setAlarmClock(AlarmManager.AlarmClockInfo(at, showIntent(context, plan)), pending)
      } else {
        // No exact-alarm grant: stay as close as the platform allows rather
        // than dropping the alarm on the floor.
        manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending)
      }
      true
    } catch (error: SecurityException) {
      try {
        manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending)
        true
      } catch (inner: Exception) {
        false
      }
    } catch (error: Exception) {
      false
    }
  }

  fun cancel(context: Context, plan: AlarmPlan) {
    val manager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
    val pending = PendingIntent.getBroadcast(
      context,
      requestCode(plan.key),
      alarmIntent(context, plan),
      PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
    )
    if (pending != null) {
      manager.cancel(pending)
      pending.cancel()
    }
  }

  /**
   * Replace the whole armed set with `plans` — the JS plan is the truth.
   *
   * Exception: native snoozes. A "Snooze" press on a notification happens
   * while the app is closed, so JS cannot know about it; those alarms carry a
   * `snooze:` key and are preserved across re-plans until they fire.
   */
  fun apply(context: Context, plans: List<AlarmPlan>): Int {
    val previous = AlarmStore.armed(context)
    val now = System.currentTimeMillis()
    val preserved = previous.filter { it.key.startsWith(SNOOZE_PREFIX) && it.fireAt > now }
    val nextKeys = (plans.map { it.key } + preserved.map { it.key }).toSet()

    previous.forEach { old ->
      if (old.key !in nextKeys) cancel(context, old)
    }

    var armed = 0
    plans.forEach { plan ->
      if (schedule(context, plan)) armed++
    }

    AlarmStore.saveArmed(
      context,
      plans.filter { it.fireAt > now - 60_000 } + preserved
    )
    return armed + preserved.size
  }

  /** Re-arm everything after a reboot; anything already past is dropped. */
  fun rearmAfterBoot(context: Context) {
    val now = System.currentTimeMillis()
    val surviving = AlarmStore.armed(context).filter { it.fireAt > now }
    surviving.forEach { plan ->
      if (plan.fireAt - now > 90_000) schedule(context, plan)
    }
    AlarmStore.saveArmed(context, surviving)
  }
}
