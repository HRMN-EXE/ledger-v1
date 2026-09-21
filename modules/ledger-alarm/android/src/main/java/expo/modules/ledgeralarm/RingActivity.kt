package expo.modules.ledgeralarm

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.KeyEvent
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * The screen a locked phone wakes up to. Built in code, drawn in native
 * widgets, so it appears instantly even when the React Native bundle is not
 * running yet — the way a system alarm behaves.
 */
class RingActivity : Activity() {

  private var alarm: AlarmPlan? = null

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val window = window
    window.addFlags(
      WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
        WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
        WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
        WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
    )
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true)
      setTurnScreenOn(true)
    }
    LedgerNotifications.ensureChannels(this)
    show(AlarmPlan.decode(intent?.getStringExtra(AlarmReceiver.EXTRA_PLAN)))
  }

  override fun onNewIntent(intent: Intent?) {
    super.onNewIntent(intent)
    show(AlarmPlan.decode(intent?.getStringExtra(AlarmReceiver.EXTRA_PLAN)))
  }

  private fun show(plan: AlarmPlan?) {
    if (plan == null) {
      finish()
      return
    }
    alarm = plan
    if (plan.isAlarm) RingService.start(this, plan)
    setContentView(buildLayout(plan))
  }

  private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

  private fun buildLayout(plan: AlarmPlan): View {
    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      setBackgroundColor(Color.parseColor("#0B0D10"))
      setPadding(dp(28), dp(48), dp(28), dp(40))
    }

    val time = TextView(this).apply {
      text = SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date())
      setTextColor(Color.parseColor("#FDF6EC"))
      textSize = 54f
      typeface = Typeface.create("sans-serif-light", Typeface.NORMAL)
      letterSpacing = 0.05f
    }
    root.addView(time)

    val kicker = TextView(this).apply {
      text = if (plan.priority == "alarm") "LEDGER ALARM" else "LEDGER REMINDER"
      setTextColor(Color.parseColor("#FB923C"))
      textSize = 12f
      typeface = Typeface.create("sans-serif", Typeface.BOLD)
      letterSpacing = 0.28f
      gravity = Gravity.CENTER
    }
    val kickerParams = LinearLayout.LayoutParams(
      LinearLayout.LayoutParams.WRAP_CONTENT,
      LinearLayout.LayoutParams.WRAP_CONTENT
    ).apply { topMargin = dp(18) }
    root.addView(kicker, kickerParams)

    val title = TextView(this).apply {
      text = plan.title
      setTextColor(Color.parseColor("#FDF6EC"))
      textSize = 26f
      typeface = Typeface.create("sans-serif-medium", Typeface.BOLD)
      gravity = Gravity.CENTER
    }
    val titleParams = LinearLayout.LayoutParams(
      LinearLayout.LayoutParams.MATCH_PARENT,
      LinearLayout.LayoutParams.WRAP_CONTENT
    ).apply { topMargin = dp(10) }
    root.addView(title, titleParams)

    if (plan.body.isNotEmpty()) {
      val body = TextView(this).apply {
        text = plan.body
        setTextColor(Color.parseColor("#A8A29E"))
        textSize = 15f
        gravity = Gravity.CENTER
      }
      val bodyParams = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        LinearLayout.LayoutParams.WRAP_CONTENT
      ).apply { topMargin = dp(8) }
      root.addView(body, bodyParams)
    }

    val spacer = View(this)
    root.addView(spacer, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f))

    if (plan.taskId != null) {
      root.addView(
        actionButton("Done — I'm up", "#F97316", "#0B0D10") {
          finishWith(RingActionReceiver.ACTION_DONE)
        }
      )
    }

    root.addView(
      actionButton(
        "Snooze ${RingActionReceiver.SNOOZE_MINUTES_ALARM} minutes",
        "#1C1B1A",
        "#FDF6EC"
      ) { finishWith(RingActionReceiver.ACTION_SNOOZE) }
    )

    root.addView(
      actionButton("Stop ringing", "#1C1B1A", "#A8A29E") {
        finishWith(RingActionReceiver.ACTION_STOP)
      }
    )

    val open = TextView(this).apply {
      text = "Open Ledger"
      setTextColor(Color.parseColor("#78716C"))
      textSize = 14f
      gravity = Gravity.CENTER
      setPadding(dp(12), dp(18), dp(12), dp(6))
      setOnClickListener {
        RingService.stop(this@RingActivity)
        val launch = packageManager.getLaunchIntentForPackage(packageName)
        if (launch != null) {
          launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          runCatching { startActivity(launch) }
        }
        finish()
      }
    }
    root.addView(open)

    return root
  }

  private fun actionButton(label: String, background: String, textColor: String, onClick: () -> Unit): Button =
    Button(this).apply {
      text = label
      isAllCaps = false
      textSize = 16f
      typeface = Typeface.create("sans-serif-medium", Typeface.BOLD)
      setTextColor(Color.parseColor(textColor))
      background = android.graphics.drawable.GradientDrawable().apply {
        setColor(Color.parseColor(background))
        cornerRadius = dp(18).toFloat()
      }
      setOnClickListener { onClick() }
      layoutParams = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        dp(56)
      ).apply { topMargin = dp(12) }
    }

  private fun finishWith(action: String) {
    val plan = alarm
    if (plan != null) RingActionReceiver.handle(this, plan, action)
    finish()
  }

  override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
    // An alarm is not dismissed with the back button.
    if (keyCode == KeyEvent.KEYCODE_BACK) return true
    return super.onKeyDown(keyCode, event)
  }
}
