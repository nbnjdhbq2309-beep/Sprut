package com.uniqdev.meetingrecorder

import android.os.Bundle
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(MeetingRecorderPlugin::class.java)
        super.onCreate(savedInstanceState)
    }
}
