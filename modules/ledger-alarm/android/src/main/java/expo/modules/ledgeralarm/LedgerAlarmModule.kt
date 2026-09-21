package expo.modules.ledgeralarm

import android.app.AlarmManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONArray

/**
 * The JS-facing half of the native alarm engine.
 *
 * JS owns the plan; this module owns the wake-up. Taps that happen while the
 * app is closed come back through `drainActions()`.
 */
class LedgerAlarmModule : Module() {

  private val context: Context?
    get() = appContext.reactContext

  private val packageUri: Uri
    get() = Uri.parse("package:${context?.packageName ?: ""}")

  private fun launch(intent: Intent): Boolean {
    val ctx = context ?: return false
    return try {
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      ctx.startActivity(intent)
      true
    } catch (error: Exception) {
      false
    }
  }

  private fun oemAutostartIntent(): Intent? {
    val component = when {
      Build.MANUFACTURER.equals("Xiaomi", ignoreCase = true) ->
        ComponentName("com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity")
      Build.MANUFACTURER.equals("Huawei", ignoreCase = true) || Build.MANUFACTURER.equals("Honor", ignoreCase = true) ->
        ComponentName("com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity")
      Build.MANUFACTURER.equals("Oppo", ignoreCase = true) || Build.MANUFACTURER.equals("Realme", ignoreCase = true) ->
        ComponentName("com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity")
      Build.MANUFACTURER.equals("Vivo", ignoreCase = true) ->
        ComponentName("com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity")
      Build.MANUFACTURER.equals("Samsung", ignoreCase = true) ->
        ComponentName("com.samsung.android.lool", "com.samsung.android.sm.ui.battery.BatteryActivity")
      else -> null
    }
    return component?.let { Intent().setComponent(it) }
  }

  override fun definition() = ModuleDefinition {
    Name("LedgerAlarm")

    Events("onAlarmAction", "onAlarmFired")

    OnCreate {
      LedgerAlarmBus.emitter = { event, payload -> sendEvent(event, payload) }
      context?.let { LedgerNotifications.ensureChannels(it) }
    }

    OnDestroy {
      LedgerAlarmBus.emitter = null
    }

    /** Replace the whole armed set. Returns how many alarms are now in AlarmManager. */
    AsyncFunction("setAlarms") { alarmsJson: String ->
      val ctx = context ?: return@AsyncFunction 0
      val array = try {
        JSONArray(alarmsJson)
      } catch (error: Exception) {
        JSONArray()
      }
      val plans = (0 until array.length()).mapNotNull { index ->
        array.optJSONObject(index)?.let { AlarmPlan.from(it) }
      }
      LedgerNotifications.ensureChannels(ctx)
      LedgerAlarmScheduler.apply(ctx, plans)
    }

    AsyncFunction("cancelAll") {
      val ctx = context ?: return@AsyncFunction 0
      val armed = AlarmStore.armed(ctx)
      armed.forEach { LedgerAlarmScheduler.cancel(ctx, it) }
      AlarmStore.saveArmed(ctx, emptyList())
      RingService.stop(ctx)
      armed.size
    }

    Function("getArmed") {
      val ctx = context ?: return@Function "[]"
      val array = JSONArray()
      AlarmStore.armed(ctx).forEach { array.put(it.toJson()) }
      array.toString()
    }

    /** Non-null while an alarm is ringing right now (survives process death). */
    Function("getRinging") {
      val ctx = context ?: return@Function null
      AlarmStore.ringing(ctx)?.encode()
    }

    Function("isRinging") { RingService.isRinging() }

    Function("stopRinging") {
      val ctx = context ?: return@Function false
      RingService.stop(ctx)
      true
    }

    /** Fire an alarm a second from now — the "does it actually ring?" button. */
    AsyncFunction("ringNow") { alarmsJson: String ->
      val ctx = context ?: return@AsyncFunction false
      val decoded = AlarmPlan.decode(alarmsJson) ?: return@AsyncFunction false
      val plan = decoded.copy(
        key = "test:${System.currentTimeMillis()}",
        fireAt = System.currentTimeMillis() + 1200
      )
      LedgerNotifications.ensureChannels(ctx)
      LedgerAlarmScheduler.schedule(ctx, plan)
    }

    /** Everything pressed while the app was closed, newest last. */
    Function("drainActions") {
      val ctx = context ?: return@Function "[]"
      AlarmStore.drainActions(ctx)
    }

    Function("getLastFired") {
      val ctx = context ?: return@Function null
      AlarmStore.lastFired(ctx)?.encode()
    }

    Function("canUseFullScreenIntent") {
      val ctx = context ?: return@Function false
      AlarmReceiver.canUseFullScreen(ctx)
    }

    Function("openFullScreenIntentSettings") {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) return@Function false
      launch(Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT).setData(packageUri))
    }

    Function("canScheduleExactAlarms") {
      val ctx = context ?: return@Function true
      LedgerAlarmScheduler.canScheduleExact(ctx)
    }

    Function("openExactAlarmSettings") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        val opened = launch(Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM).setData(packageUri))
        if (opened) return@Function true
      }
      val ctx = context ?: return@Function false
      val manager = ctx.getSystemService(Context.ALARM_SERVICE) as? AlarmManager
      if (manager != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        return@Function manager.canScheduleExactAlarms()
      }
      true
    }

    Function("isIgnoringBatteryOptimizations") {
      val ctx = context ?: return@Function false
      val power = ctx.getSystemService(Context.POWER_SERVICE) as? PowerManager ?: return@Function false
      power.isIgnoringBatteryOptimizations(ctx.packageName)
    }

    Function("requestIgnoreBatteryOptimizations") {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return@Function true
      launch(
        Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).setData(packageUri)
      )
    }

    Function("openBatterySettings") {
      launch(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
    }

    Function("openAutostartSettings") {
      val intent = oemAutostartIntent()
      if (intent != null && launch(intent)) return@Function true
      launch(
        Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).setData(packageUri)
      )
    }

    Function("openAppNotificationSettings") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        launch(
          Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
            .putExtra(Settings.EXTRA_APP_PACKAGE, context?.packageName)
        )
      } else {
        launch(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).setData(packageUri))
      }
    }
  }
}
