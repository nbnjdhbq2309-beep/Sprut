package com.uniqdev.meetingrecorder

import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.widget.Toast
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(MeetingRecorderPlugin::class.java)
        super.onCreate(savedInstanceState)

        Handler(Looper.getMainLooper()).postDelayed({
            val found = try {
                bridge?.getPlugin("MeetingRecorder") != null
            } catch (e: Exception) {
                false
            }
            Toast.makeText(
                this,
                "[Native diag] MainActivity.onCreate выполнен. MeetingRecorder в Bridge: ${if (found) "ЕСТЬ" else "НЕТ"}",
                Toast.LENGTH_LONG
            ).show()
        }, 1500)
    }
}
