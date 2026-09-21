package expo.modules.ledgeralarm

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/**
 * The native mirror of the JS plan, plus the outbox that carries taps back to
 * JS. Both live in SharedPreferences so a reboot, a process death or a cold
 * start by the alarm itself always finds them.
 */
object AlarmStore {
  private const val PREFS = "ledger-native-alarms-v1"
  private const val KEY_ARMED = "armed"
  private const val KEY_OUTBOX = "outbox"
  private const val KEY_RINGING = "ringing"
  private const val KEY_LAST_FIRED = "last-fired"
  private const val OUTBOX_LIMIT = 200

  private fun prefs(context: Context) =
    context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun armed(context: Context): List<AlarmPlan> {
    val raw = prefs(context).getString(KEY_ARMED, null) ?: return emptyList()
    return try {
      val array = JSONArray(raw)
      (0 until array.length()).mapNotNull { index ->
        array.optJSONObject(index)?.let { AlarmPlan.from(it) }
      }
    } catch (error: Exception) {
      emptyList()
    }
  }

  fun saveArmed(context: Context, plans: List<AlarmPlan>) {
    val array = JSONArray()
    plans.forEach { array.put(it.toJson()) }
    prefs(context).edit().putString(KEY_ARMED, array.toString()).apply()
  }

  fun setRinging(context: Context, plan: AlarmPlan?) {
    val editor = prefs(context).edit()
    if (plan == null) {
      editor.remove(KEY_RINGING)
    } else {
      editor.putString(KEY_RINGING, plan.encode())
    }
    editor.apply()
  }

  fun ringing(context: Context): AlarmPlan? {
    val raw = prefs(context).getString(KEY_RINGING, null) ?: return null
    return try {
      AlarmPlan.from(JSONObject(raw))
    } catch (error: Exception) {
      null
    }
  }

  fun markFired(context: Context, plan: AlarmPlan) {
    prefs(context).edit().putString(KEY_LAST_FIRED, plan.encode()).apply()
  }

  fun lastFired(context: Context): AlarmPlan? {
    val raw = prefs(context).getString(KEY_LAST_FIRED, null) ?: return null
    return try {
      AlarmPlan.from(JSONObject(raw))
    } catch (error: Exception) {
      null
    }
  }

  /** A tap / button press we owe the JS layer. */
  fun pushAction(context: Context, plan: AlarmPlan, action: String, source: String) {
    val entry = JSONObject()
    entry.put("action", action)
    entry.put("source", source)
    entry.put("at", System.currentTimeMillis())
    entry.put("key", plan.key)
    entry.put("kind", plan.kind)
    entry.put("priority", plan.priority)
    entry.put("title", plan.title)
    entry.put("body", plan.body)
    entry.put("taskId", plan.taskId ?: JSONObject.NULL)
    entry.put("ritualId", plan.ritualId ?: JSONObject.NULL)
    entry.put("day", plan.day ?: JSONObject.NULL)
    entry.put("fireAt", plan.fireAt)

    val current = try {
      JSONArray(prefs(context).getString(KEY_OUTBOX, "[]"))
    } catch (error: Exception) {
      JSONArray()
    }
    val next = JSONArray()
    val start = maxOf(0, current.length() - (OUTBOX_LIMIT - 1))
    for (index in start until current.length()) {
      current.opt(index)?.let { next.put(it) }
    }
    next.put(entry)
    prefs(context).edit().putString(KEY_OUTBOX, next.toString()).apply()
  }

  /** Read and clear — actions are applied to the database exactly once. */
  fun drainActions(context: Context): String {
    val prefs = prefs(context)
    val raw = prefs.getString(KEY_OUTBOX, "[]") ?: "[]"
    prefs.edit().putString(KEY_OUTBOX, "[]").apply()
    return raw
  }

  fun clear(context: Context) {
    prefs(context).edit().clear().apply()
  }
}
