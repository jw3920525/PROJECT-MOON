package com.icemoca.limbusbeep

import android.annotation.SuppressLint
import android.app.AlarmManager
import android.app.Dialog
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.ActivityInfo
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Message
import android.os.VibrationEffect
import android.os.Vibrator
import android.view.View
import android.view.WindowManager
import android.webkit.*
import androidx.appcompat.app.AppCompatActivity
import org.json.JSONArray

class MainActivity : AppCompatActivity() {

    companion object {
        const val ALARM_CHANNEL_ID = "limbus_beep_alarms"
        private const val PERMISSION_REQUEST_CODE = 101
    }

    private lateinit var webView: WebView
    private var popupDialog: Dialog? = null

    inner class AndroidBridge {
        @JavascriptInterface
        fun setOrientation(orientation: String) {
            runOnUiThread {
                when (orientation) {
                    "landscape" -> requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
                    "portrait" -> requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_PORTRAIT
                    "sensor" -> requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR
                    else -> requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
                }
            }
        }

        @JavascriptInterface
        fun openSystemBrowser(url: String) {
            runOnUiThread {
                try {
                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                    startActivity(intent)
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        }

        @JavascriptInterface
        fun fetchIcsDirect(urlStr: String): String {
            return try {
                val url = java.net.URL(urlStr.trim())
                val conn = url.openConnection() as java.net.HttpURLConnection
                conn.requestMethod = "GET"
                conn.connectTimeout = 12000
                conn.readTimeout = 12000
                conn.instanceFollowRedirects = true
                conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
                val responseCode = conn.responseCode
                if (responseCode in 200..299) {
                    conn.inputStream.bufferedReader().use { it.readText() }
                } else {
                    val err = conn.errorStream?.bufferedReader()?.use { it.readText() } ?: ""
                    "ERROR: HTTP $responseCode - $err"
                }
            } catch (e: Exception) {
                "ERROR: ${e.message}"
            }
        }

        @JavascriptInterface
        fun syncAlarms(jsonStr: String) {
            try {
                cancelAllAlarms()
                val jsonArray = JSONArray(jsonStr)
                val alarmManager = getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
                
                for (i in 0 until jsonArray.length()) {
                    val obj = jsonArray.getJSONObject(i)
                    val id = obj.optInt("id", i + 1)
                    val title = obj.optString("title", "단테 삐삐 일정 알람")
                    val message = obj.optString("message", "")
                    val time = obj.optString("time", "")
                    val triggerAtMillis = obj.optLong("triggerAtMillis", 0L)

                    if (triggerAtMillis > System.currentTimeMillis()) {
                        val intent = Intent(this@MainActivity, AlarmReceiver::class.java).apply {
                            putExtra("EXTRA_ID", id)
                            putExtra("EXTRA_TITLE", title)
                            putExtra("EXTRA_MESSAGE", message)
                            putExtra("EXTRA_TIME", time)
                        }
                        val pendingIntent = PendingIntent.getBroadcast(
                            this@MainActivity,
                            id,
                            intent,
                            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                        )

                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                            if (alarmManager.canScheduleExactAlarms()) {
                                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent)
                            } else {
                                alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent)
                            }
                        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                            alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent)
                        } else {
                            alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent)
                        }
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }

        @JavascriptInterface
        fun requestNotificationPermission() {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                runOnUiThread {
                    try {
                        if (checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                            requestPermissions(arrayOf(android.Manifest.permission.POST_NOTIFICATIONS), PERMISSION_REQUEST_CODE)
                        }
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                }
            }
        }

        @JavascriptInterface
        fun cancelAllAlarms() {
            try {
                val alarmManager = getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
                for (id in 0..500) {
                    val intent = Intent(this@MainActivity, AlarmReceiver::class.java)
                    val pendingIntent = PendingIntent.getBroadcast(
                        this@MainActivity,
                        id,
                        intent,
                        PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
                    )
                    if (pendingIntent != null) {
                        alarmManager.cancel(pendingIntent)
                        pendingIntent.cancel()
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }

        @JavascriptInterface
        fun vibrate(durationMs: Long) {
            try {
                val vibrator = getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
                if (vibrator != null && vibrator.hasVibrator()) {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        vibrator.vibrate(VibrationEffect.createOneShot(if (durationMs > 0) durationMs else 400L, VibrationEffect.DEFAULT_AMPLITUDE))
                    } else {
                        @Suppress("DEPRECATION")
                        vibrator.vibrate(if (durationMs > 0) durationMs else 400L)
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }

        @JavascriptInterface
        fun triggerNotification(title: String, message: String, timeInfo: String) {
            try {
                val intent = Intent(this@MainActivity, AlarmReceiver::class.java).apply {
                    putExtra("EXTRA_TITLE", title)
                    putExtra("EXTRA_MESSAGE", message)
                    putExtra("EXTRA_TIME", timeInfo)
                    putExtra("EXTRA_ID", (System.currentTimeMillis() % 100000).toInt())
                }
                sendBroadcast(intent)
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    private fun createNotificationChannel() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val channel = NotificationChannel(
                    ALARM_CHANNEL_ID,
                    "Limbus Beep 일정 알람",
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = "등록된 시간에 도착하는 단테 삐삐 일정 알림"
                    enableVibration(true)
                    vibrationPattern = longArrayOf(0, 350, 200, 350, 200, 600)
                }
                val notificationManager = getSystemService(NotificationManager::class.java)
                notificationManager?.createNotificationChannel(channel)
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) {
            try {
                @Suppress("DEPRECATION")
                window.decorView.systemUiVisibility = (
                    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    or View.SYSTEM_UI_FLAG_FULLSCREEN
                    or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                )
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        createNotificationChannel()

        try {
            // Fullscreen immersive sticky mode
            window.setFlags(
                WindowManager.LayoutParams.FLAG_FULLSCREEN,
                WindowManager.LayoutParams.FLAG_FULLSCREEN
            )
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = (
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                or View.SYSTEM_UI_FLAG_FULLSCREEN
                or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            )
        } catch (e: Exception) {
            e.printStackTrace()
        }

        webView = WebView(this)
        setContentView(webView)

        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.allowFileAccess = true
        settings.allowContentAccess = true
        settings.databaseEnabled = true
        settings.mediaPlaybackRequiresUserGesture = false
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
        settings.setSupportMultipleWindows(true)
        settings.javaScriptCanOpenWindowsAutomatically = true
        settings.cacheMode = WebSettings.LOAD_DEFAULT

        webView.addJavascriptInterface(AndroidBridge(), "AndroidBridge")

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url?.toString() ?: return false
                if (url.contains("access_token=")) {
                    handleExtractedToken(url)
                    return true
                }
                return false
            }
        }

        // WebChromeClient with full popup / window.open support
        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest?) {
                request?.grant(request.resources)
            }

            @SuppressLint("SetJavaScriptEnabled")
            override fun onCreateWindow(
                view: WebView?,
                isDialog: Boolean,
                isUserGesture: Boolean,
                resultMsg: Message?
            ): Boolean {
                val popupWebView = WebView(this@MainActivity)
                val pSettings = popupWebView.settings
                pSettings.javaScriptEnabled = true
                pSettings.domStorageEnabled = true
                pSettings.setSupportMultipleWindows(true)
                pSettings.javaScriptCanOpenWindowsAutomatically = true
                // Standard mobile Chrome User-Agent to ensure Google OAuth compatibility
                pSettings.userAgentString = "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36"

                popupDialog = Dialog(this@MainActivity, android.R.style.Theme_Black_NoTitleBar_Fullscreen)
                popupDialog?.setContentView(popupWebView)
                popupDialog?.show()

                popupWebView.webChromeClient = object : WebChromeClient() {
                    override fun onCloseWindow(window: WebView?) {
                        popupDialog?.dismiss()
                    }
                }

                popupWebView.webViewClient = object : WebViewClient() {
                    override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                        val targetUrl = request?.url?.toString() ?: return false
                        if (targetUrl.contains("access_token=")) {
                            handleExtractedToken(targetUrl)
                            popupDialog?.dismiss()
                            return true
                        }
                        return false
                    }

                    override fun onPageFinished(view: WebView?, url: String?) {
                        super.onPageFinished(view, url)
                        if (url != null && url.contains("access_token=")) {
                            handleExtractedToken(url)
                            popupDialog?.dismiss()
                        }
                    }
                }

                val transport = resultMsg?.obj as? WebView.WebViewTransport
                transport?.webView = popupWebView
                resultMsg?.sendToTarget()
                return true
            }
        }

        webView.loadUrl("file:///android_asset/index.html")
    }

    private fun handleExtractedToken(urlWithToken: String) {
        val token = urlWithToken.substringAfter("access_token=").substringBefore("&")
        if (token.isNotEmpty()) {
            runOnUiThread {
                webView.evaluateJavascript("window.pagerApp && window.pagerApp.onOAuthTokenReceived('$token')", null)
            }
        }
    }

    override fun onBackPressed() {
        if (popupDialog?.isShowing == true) {
            popupDialog?.dismiss()
        } else if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }
}
