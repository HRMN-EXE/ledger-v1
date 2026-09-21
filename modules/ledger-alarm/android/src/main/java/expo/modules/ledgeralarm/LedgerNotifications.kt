package expo.modules.ledgeralarm

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat

/**
 * Channels + notification construction. The alarm channel is deliberately the
 * loudest thing Android allows: MAX importance, alarm audio stream, long
 * vibration, public on the lock screen, and a full-screen intent.
 */
object LedgerNotifications {
  const val CHANNEL_ALARM = "ledger_ring_alarms"
  const val CHANNEL_REMINDER = "ledger_ring_reminders"
  const val CHANNEL_BRIEF = "ledger_ring_briefs"

  const val NOTIFICATION_ID_RING = 4201
  private const val NOTIFICATION_ID_BASE = 5200
  private const val ACCENT = 0xFFF97316.toInt()

  private val ALARM_PATTERN = longArrayOf(0, 700, 400, 700, 400, 700)
  private val REMINDER_PATTERN = longArrayOf(0, 250, 200, 250)

  fun channelFor(priority: String): String = when (priority) {
    "alarm" -> CHANNEL_ALARM
    "reminder" -> CHANNEL_REMINDER
    else -> CHANNEL_BRIEF
  }

  private fun soundName(priority: String): String = when (priority) {
    "alarm" -> "ledger_alarm"
    "reminder" -> "ledger_chime"
    else -> "ledger_nudge"
  }

  private fun attributes(priority: String) = AudioAttributes.Builder()
    .setUsage(if (priority == "alarm") AudioAttributes.USAGE_ALARM else AudioAttributes.USAGE_NOTIFICATION)
    .setContentType(if (priority == "alarm") AudioAttributes.CONTENT_TYPE_SONIC else AudioAttributes.CONTENT_TYPE_SONIFICATION)
    .build()

  fun resourceId(context: Context, name: String): Int =
    context.resources.getIdentifier(name, "raw", context.packageName)

  fun soundUri(context: Context, priority: String): Uri {
    val id = resourceId(context, soundName(priority))
    if (id != 0) return Uri.parse("android.resource://${context.packageName}/$id")
    return RingtoneManager.getDefaultUri(
      if (priority == "alarm") RingtoneManager.TYPE_ALARM else RingtoneManager.TYPE_NOTIFICATION
    )
  }

  fun ensureChannels(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = context.getSystemService(NotificationManager::class.java) ?: return

    create(
      context, manager, CHANNEL_ALARM,
      "Task alarms",
      "Full-volume alarms that take over the screen",
      NotificationManager.IMPORTANCE_MAX,
      "alarm", ALARM_PATTERN, true
    )
    create(
      context, manager, CHANNEL_REMINDER,
      "Reminders",
      "A chime a few minutes before a task",
      NotificationManager.IMPORTANCE_HIGH,
      "reminder", REMINDER_PATTERN, false
    )
    create(
      context, manager, CHANNEL_BRIEF,
      "Briefs & nudges",
      "Morning brief, evening check-in, streak warnings",
      NotificationManager.IMPORTANCE_DEFAULT,
      "brief", null, false
    )
  }

  private fun create(
    context: Context,
    manager: NotificationManager,
    id: String,
    name: String,
    description: String,
    importance: Int,
    priority: String,
    pattern: LongArray?,
    alarms: Boolean
  ) {
    if (manager.getNotificationChannel(id) != null) return
    val channel = NotificationChannel(id, name, importance)
    channel.description = description
    channel.setSound(soundUri(context, priority), attributes(priority))
    channel.enableVibration(pattern != null)
    if (pattern != null) channel.vibrationPattern = pattern
    channel.enableLights(true)
    channel.lightColor = ACCENT
    channel.lockscreenVisibility = Notification.VISIBILITY_PUBLIC
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      channel.setAllowBubbles(false)
    }
    if (alarms) {
      // Ignored unless the user granted Do Not Disturb access — harmless if not.
      runCatching { channel.setBypassDnd(true) }
    }
    runCatching { manager.createNotificationChannel(channel) }
  }

  private fun actionIntent(
    context: Context,
    plan: AlarmPlan,
    action: String,
    requestOffset: Int
  ): PendingIntent =
    PendingIntent.getBroadcast(
      context,
      (plan.key.hashCode() and 0x000FFFFF) + requestOffset,
      Intent(context, RingActionReceiver::class.java).apply {
        this.action = action
        putExtra(AlarmReceiver.EXTRA_PLAN, plan.encode())
      },
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

  fun contentIntent(context: Context, plan: AlarmPlan): PendingIntent {
    val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
    val intent = launch ?: Intent(context, RingActivity::class.java).apply { addFlags(Intent.FLAG_ACTIVITY_NEW_TASK) }
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    return PendingIntent.getActivity(
      context,
      (plan.key.hashCode() and 0x000FFFFF) + 0x300000,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
  }

  fun ringActivityIntent(context: Context, plan: AlarmPlan): PendingIntent =
    PendingIntent.getActivity(
      context,
      0x400000 + (plan.key.hashCode() and 0x000FFF),
      Intent(context, RingActivity::class.java).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK or Intent.FLAG_ACTIVITY_NO_USER_ACTION)
        putExtra(AlarmReceiver.EXTRA_PLAN, plan.encode())
      },
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

  fun build(context: Context, plan: AlarmPlan, fullScreen: Boolean): Notification {
    val builder = NotificationCompat.Builder(context, channelFor(plan.priority))
      .setSmallIcon(R.drawable.ledger_notif_icon)
      .setContentTitle(plan.title)
      .setContentText(plan.body)
      .setStyle(NotificationCompat.BigTextStyle().bigText(plan.body))
      .setColor(ACCENT)
      .setCategory(if (plan.isAlarm) NotificationCompat.CATEGORY_ALARM else NotificationCompat.CATEGORY_REMINDER)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setPriority(if (plan.isAlarm) NotificationCompat.PRIORITY_MAX else NotificationCompat.PRIORITY_HIGH)
      .setAutoCancel(!plan.isAlarm)
      .setOngoing(plan.isAlarm)
      .setWhen(plan.fireAt)
      .setShowWhen(false)
      .setContentIntent(contentIntent(context, plan))

    if (plan.taskId != null) {
      builder.addAction(
        R.drawable.ledger_notif_icon,
        "Done",
        actionIntent(context, plan, RingActionReceiver.ACTION_DONE, 0x100000)
      )
    }
    builder.addAction(
      R.drawable.ledger_notif_icon,
      "Snooze ${if (plan.isAlarm) "10 min" else "5 min"}",
      actionIntent(context, plan, RingActionReceiver.ACTION_SNOOZE, 0x200000)
    )
    builder.addAction(
      R.drawable.ledger_notif_icon,
      "Stop",
      actionIntent(context, plan, RingActionReceiver.ACTION_STOP, 0x500000)
    )

    if (plan.isAlarm) {
      builder.setSound(soundUri(context, plan.priority))
      builder.setVibrate(ALARM_PATTERN)
      if (fullScreen) {
        builder.setFullScreenIntent(ringActivityIntent(context, plan), true)
      }
      builder.setTimeoutAfter(30 * 60 * 1000L)
    }

    return builder.build()
  }

  fun notifyId(plan: AlarmPlan): Int = NOTIFICATION_ID_BASE + (plan.key.hashCode() and 0xFFF)
}
