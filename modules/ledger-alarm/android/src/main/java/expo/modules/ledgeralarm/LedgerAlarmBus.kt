package expo.modules.ledgeralarm

/**
 * A tiny bridge so receivers and services — which have no idea whether React
 * Native is even alive — can still push events into JS when it is.
 */
object LedgerAlarmBus {
  @Volatile
  var emitter: ((String, Map<String, Any?>) -> Unit)? = null

  fun emit(event: String, payload: Map<String, Any?>) {
    val sink = emitter ?: return
    runCatching { sink(event, payload) }
  }
}
