package expo.modules.ledgeralarm

import org.json.JSONObject

/**
 * One planned alert, exactly as the JS engine described it. The native side
 * never invents alarms — it only arms, rings and reports back.
 */
data class AlarmPlan(
  val key: String,
  val kind: String,
  val fireAt: Long,
  val priority: String,
  val title: String,
  val body: String,
  val taskId: Int?,
  val ritualId: Int?,
  val day: String?
) {
  val isAlarm: Boolean
    get() = priority == "alarm"

  fun toJson(): JSONObject {
    val json = JSONObject()
    json.put("key", key)
    json.put("kind", kind)
    json.put("fireAt", fireAt)
    json.put("priority", priority)
    json.put("title", title)
    json.put("body", body)
    json.put("taskId", taskId ?: JSONObject.NULL)
    json.put("ritualId", ritualId ?: JSONObject.NULL)
    json.put("day", day ?: JSONObject.NULL)
    return json
  }

  fun encode(): String = toJson().toString()

  companion object {
    fun from(json: JSONObject) = AlarmPlan(
      key = json.optString("key"),
      kind = json.optString("kind"),
      fireAt = json.optLong("fireAt"),
      priority = json.optString("priority", "reminder"),
      title = json.optString("title", "Ledger"),
      body = json.optString("body", ""),
      taskId = if (json.isNull("taskId")) null else json.optInt("taskId"),
      ritualId = if (json.isNull("ritualId")) null else json.optInt("ritualId"),
      day = if (json.isNull("day")) null else json.optString("day")
    )

    fun decode(raw: String?): AlarmPlan? {
      if (raw.isNullOrEmpty()) return null
      return try {
        from(JSONObject(raw))
      } catch (error: Exception) {
        null
      }
    }
  }
}
