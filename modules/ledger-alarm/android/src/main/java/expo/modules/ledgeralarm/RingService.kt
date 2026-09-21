package expo.modules.ledgeralarm

import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.Ringtone
import android.media.RingtoneManager
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat

/**
 * The ringing itself: a foreground service that loops the alarm tone on the
 * ALARM audio stream and buzzes in a long pattern until somebody deals with
 * it. Foreground is what keeps it alive while the app is closed.
 */
class RingService : Service() {

  companion object {
    const val ACTION_START = "expo.modules.ledgeralarm.RING_START"
    const val ACTION_STOP = "expo.modules.ledgeralarm.RING_STOP"
    /** Which channel this service rings on — the loudest one there is. */
    private const val CHANNEL_ID = LedgerNotifications.CHANNEL_ALARM
    private const val NOTIFICATION_ID = LedgerNotifications.NOTIFICATION_ID_RING

    @Volatile
    private var current: RingService? = null

    val plan: AlarmPlan?
      get() = current?.alarm

    fun isRinging(): Boolean = current != null

    fun start(context: Context, alarm: AlarmPlan) {
      val intent = Intent(context, RingService::class.java).apply {
        action = ACTION_START
        putExtra(AlarmReceiver.EXTRA_PLAN, alarm.encode())
      }
      try {
        ContextCompat.startForegroundService(context, intent)
      } catch (error: Exception) {
        // Android 14 background-start limits: the notification is already
        // ringing, so a failed service start is a downgrade, not a loss.
        runCatching { context.startService(intent) }
      }
    }

    fun stop(context: Context) {
      val intent = Intent(context, RingService::class.java).apply { action = ACTION_STOP }
      runCatching { context.startService(intent) }
      runCatching { context.stopService(Intent(context, RingService::class.java)) }
    }
  }

  private var alarm: AlarmPlan? = null
  private var player: MediaPlayer? = null
  private var fallbackRingtone: Ringtone? = null
  private var vibrator: Vibrator? = null

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_STOP) {
      shutdown()
      return START_NOT_STICKY
    }

    val next = AlarmPlan.decode(intent?.getStringExtra(AlarmReceiver.EXTRA_PLAN))
    if (next == null) {
      shutdown()
      return START_NOT_STICKY
    }

    alarm = next
    current = this
    LedgerNotifications.ensureChannels(this)

    val notification = LedgerNotifications.build(this, next, false)
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
      } else {
        startForeground(NOTIFICATION_ID, notification)
      }
    } catch (error: Exception) {
      runCatching {
        val manager = getSystemService(NotificationManager::class.java)
        manager?.notify(NOTIFICATION_ID, notification)
      }
    }

    if (next.isAlarm) {
      boostStreamVolume()
      startSound(next)
      startVibration()
    }

    return START_STICKY
  }

  private fun boostStreamVolume() {
    // Never fight the user, but a silent alarm stream is a bug, not a choice.
    try {
      val audio = getSystemService(Context.AUDIO_SERVICE) as? AudioManager ?: return
      val max = audio.getStreamMaxVolume(AudioManager.STREAM_ALARM)
      if (audio.getStreamVolume(AudioManager.STREAM_ALARM) == 0 && max > 0) {
        audio.setStreamVolume(AudioManager.STREAM_ALARM, maxOf(1, max / 3), 0)
      }
    } catch (error: Exception) {
      // ignore
    }
  }

  private fun startSound(alarm: AlarmPlan) {
    val attributes = AudioAttributes.Builder()
      .setUsage(AudioAttributes.USAGE_ALARM)
      .setContentType(AudioAttributes.CONTENT_TYPE_SONIC)
      .build()

    val id = LedgerNotifications.resourceId(this, "ledger_alarm")
    if (id != 0) {
      try {
        val descriptor = resources.openRawResourceFd(id)
        val media = MediaPlayer()
        media.setAudioAttributes(attributes)
        media.setDataSource(descriptor.fileDescriptor, descriptor.startOffset, descriptor.length)
        descriptor.close()
        media.isLooping = true
        media.setVolume(1f, 1f)
        runCatching { media.setWakeMode(applicationContext, PowerManager.PARTIAL_WAKE_LOCK) }
        media.prepare()
        media.start()
        player = media
        return
      } catch (error: Exception) {
        runCatching { player?.release() }
        player = null
      }
    }

    // Fallback: whatever alarm tone the phone ships with.
    try {
      val uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
        ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
      val ringtone = RingtoneManager.getRingtone(applicationContext, uri)
      ringtone.audioAttributes = attributes
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) ringtone.isLooping = true
      ringtone.play()
      fallbackRingtone = ringtone
    } catch (error: Exception) {
      // nothing left to try — vibration and the notification still fire
    }
  }

  private fun startVibration() {
    try {
      val device = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        val manager = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
        manager?.defaultVibrator
      } else {
        @Suppress("DEPRECATION")
        getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
      } ?: return

      val pattern = longArrayOf(0, 700, 400, 700, 400, 700)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        device.vibrate(VibrationEffect.createWaveform(pattern, 1))
      } else {
        @Suppress("DEPRECATION")
        device.vibrate(pattern, 1)
      }
      vibrator = device
    } catch (error: Exception) {
      // device without a vibrator
    }
  }

  private fun shutdown() {
    runCatching { player?.stop() }
    runCatching { player?.release() }
    player = null
    runCatching { fallbackRingtone?.stop() }
    fallbackRingtone = null
    runCatching { vibrator?.cancel() }
    vibrator = null
    current = null
    alarm = null
    AlarmStore.setRinging(this, null)
    runCatching {
      val manager = getSystemService(NotificationManager::class.java)
      manager?.cancel(NOTIFICATION_ID)
    }
    ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
    stopSelf()
  }

  override fun onDestroy() {
    runCatching { player?.release() }
    player = null
    runCatching { fallbackRingtone?.stop() }
    fallbackRingtone = null
    runCatching { vibrator?.cancel() }
    vibrator = null
    if (current === this) {
      current = null
      alarm = null
      AlarmStore.setRinging(this, null)
    }
    runCatching {
      val manager = getSystemService(NotificationManager::class.java)
      manager?.cancel(NOTIFICATION_ID)
    }
    super.onDestroy()
  }
}
