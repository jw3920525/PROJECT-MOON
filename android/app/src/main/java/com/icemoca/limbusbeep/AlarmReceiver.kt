package com.icemoca.limbusbeep

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.media.RingtoneManager
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import androidx.core.app.NotificationCompat

class AlarmReceiver : BroadcastReceiver() {
    companion object {
        @Volatile
        private var lastTriggerTime: Long = 0L
        @Volatile
        private var lastTriggerKey: String = ""
    }

    override fun onReceive(context: Context, intent: Intent) {
        try {
            val title = intent.getStringExtra("EXTRA_TITLE") ?: "단테 삐삐 일정 알람"
            val message = intent.getStringExtra("EXTRA_MESSAGE") ?: "등록된 일정 시간이 되었습니다."
            val timeInfo = intent.getStringExtra("EXTRA_TIME") ?: ""
            val notificationId = intent.getIntExtra("EXTRA_ID", (System.currentTimeMillis() % 100000).toInt())

            // 동일 알람 중복 발송 방지 (15초 이내 동일 알람 수신 시 무시)
            val dedupeKey = "$title|$message|$timeInfo"
            val now = System.currentTimeMillis()
            synchronized(AlarmReceiver::class.java) {
                if (dedupeKey == lastTriggerKey && (now - lastTriggerTime) < 15000L) {
                    return
                }
                lastTriggerKey = dedupeKey
                lastTriggerTime = now
            }

            val openIntent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val pendingIntent = PendingIntent.getActivity(
                context,
                notificationId,
                openIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
            val channelId = MainActivity.ALARM_CHANNEL_ID

            val fullTitle = if (timeInfo.isNotEmpty()) "$title [$timeInfo]" else title
            val notification = NotificationCompat.Builder(context, channelId)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(fullTitle)
                .setContentText(message)
                .setStyle(NotificationCompat.BigTextStyle().bigText(message))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setAutoCancel(true)
                .setSound(soundUri)
                .setVibrate(longArrayOf(0, 350, 200, 350, 200, 600))
                .setContentIntent(pendingIntent)
                .build()

            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
            notificationManager?.notify(notificationId, notification)

            // 진동 실행
            try {
                val vibrator = context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
                if (vibrator != null && vibrator.hasVibrator()) {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        vibrator.vibrate(VibrationEffect.createWaveform(longArrayOf(0, 350, 200, 350, 200, 600), -1))
                    } else {
                        @Suppress("DEPRECATION")
                        vibrator.vibrate(longArrayOf(0, 350, 200, 350, 200, 600), -1)
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }
}
