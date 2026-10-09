package com.hslling.recordwidget;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.ContentValues;
import android.content.ContentResolver;
import android.media.MediaRecorder;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.IBinder;
import android.provider.MediaStore;
import android.widget.Toast;

import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

import java.io.File;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class RecordService extends Service {

    static final String ACTION_TOGGLE = "com.hslling.recordwidget.TOGGLE";
    private static final String CHANNEL_ID = "record_service";
    private static final int NOTIF_ID = 1001;

    private static volatile boolean recording = false;
    private MediaRecorder recorder;
    private String currentName;

    static boolean isRecording() {
        return recording;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_TOGGLE.equals(intent.getAction())) {
            if (recording) {
                stopRecording();
            } else {
                startRecording();
            }
        }
        return START_NOT_STICKY;
    }

    private boolean hasMicPerm() {
        return ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
                == PackageManager.PERMISSION_GRANTED;
    }

    private void startRecording() {
        if (!hasMicPerm()) {
            Toast.makeText(this, R.string.toast_perm_denied, Toast.LENGTH_LONG).show();
            return;
        }

        String ts = new SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(new Date());
        currentName = "录音_" + ts + ".m4a";

        try {
            recorder = new MediaRecorder();
            recorder.setAudioSource(MediaRecorder.AudioSource.VOICE_COMMUNICATION);
            recorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4);
            recorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC);
            recorder.setAudioEncodingBitRate(128000);
            recorder.setAudioSamplingRate(44100);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentValues vals = new ContentValues();
                vals.put(MediaStore.Audio.Media.DISPLAY_NAME, currentName);
                vals.put(MediaStore.Audio.Media.MIME_TYPE, "audio/mp4");
                vals.put(MediaStore.Audio.Media.RELATIVE_PATH, Environment.DIRECTORY_MUSIC + "/录音小部件");
                vals.put(MediaStore.Audio.Media.IS_PENDING, 1);
                ContentResolver cr = getContentResolver();
                Uri collection = MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
                Uri uri = cr.insert(collection, vals);
                if (uri == null) throw new IllegalStateException("无法创建音频文件");
                try (android.os.ParcelFileDescriptor pfd = cr.openFileDescriptor(uri, "w")) {
                    recorder.setOutputFile(pfd.getFileDescriptor());
                    recorder.prepare();
                    recorder.start();
                }
                pendingUri = uri;
            } else {
                File dir = new File(
                        Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_MUSIC),
                        "录音小部件");
                if (!dir.exists()) dir.mkdirs();
                File file = new File(dir, currentName);
                recorder.setOutputFile(file.getAbsolutePath());
                recorder.prepare();
                recorder.start();
                pendingUri = Uri.fromFile(file);
            }

            recording = true;
            startForeground(NOTIF_ID, buildNotification());
            RecordWidgetProvider.pushUpdate(this, true);
        } catch (Exception e) {
            e.printStackTrace();
            Toast.makeText(this, R.string.toast_error, Toast.LENGTH_LONG).show();
            cleanupRecorder();
            stopForegroundInternal();
        }
    }

    private Uri pendingUri;

    private void stopRecording() {
        try {
            if (recorder != null) {
                recorder.stop();
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        cleanupRecorder();

        if (pendingUri != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContentValues vals = new ContentValues();
            vals.put(MediaStore.Audio.Media.IS_PENDING, 0);
            getContentResolver().update(pendingUri, vals, null, null);
        }
        String savedName = currentName != null ? currentName : "录音";
        Toast.makeText(this, getString(R.string.toast_saved, savedName), Toast.LENGTH_LONG).show();

        recording = false;
        RecordWidgetProvider.pushUpdate(this, false);
        stopForegroundInternal();
    }

    private void cleanupRecorder() {
        if (recorder != null) {
            try {
                recorder.reset();
                recorder.release();
            } catch (Exception ignored) {
            }
            recorder = null;
        }
    }

    private void stopForegroundInternal() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE);
        } else {
            stopForeground(true);
        }
        stopSelf();
    }

    private Notification buildNotification() {
        ensureChannel();
        Intent stopIntent = new Intent(this, RecordService.class);
        stopIntent.setAction(ACTION_TOGGLE);
        PendingIntent pi = PendingIntent.getService(this, 1, stopIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle(getString(R.string.notif_recording_title))
                .setContentText(getString(R.string.notif_recording_text))
                .setSmallIcon(android.R.drawable.ic_btn_speak_now)
                .setOngoing(true)
                .setContentIntent(pi)
                .build();
    }

    private void ensureChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null && nm.getNotificationChannel(CHANNEL_ID) == null) {
                NotificationChannel ch = new NotificationChannel(
                        CHANNEL_ID, getString(R.string.notif_channel),
                        NotificationManager.IMPORTANCE_LOW);
                nm.createNotificationChannel(ch);
            }
        }
    }
}
