package com.hslling.recordwidget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

public class RecordWidgetProvider extends AppWidgetProvider {

    static void pushUpdate(Context ctx, boolean recording) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        ComponentName comp = new ComponentName(ctx, RecordWidgetProvider.class);
        int[] ids = mgr.getAppWidgetIds(comp);
        if (ids.length == 0) return;
        RemoteViews views = buildViews(ctx, recording);
        for (int id : ids) {
            mgr.partiallyUpdateAppWidget(id, views);
        }
    }

    static RemoteViews buildViews(Context ctx, boolean recording) {
        RemoteViews views = new RemoteViews(ctx.getPackageName(), R.layout.widget_layout);
        views.setTextViewText(R.id.widget_title, ctx.getString(R.string.widget_title));
        views.setTextViewText(
                R.id.widget_status,
                ctx.getString(recording ? R.string.widget_status_recording : R.string.widget_status_idle));
        views.setInt(R.id.btn_icon, "setBackgroundResource",
                recording ? R.drawable.icon_stop : R.drawable.icon_record);

        Intent intent = new Intent(ctx, RecordService.class);
        intent.setAction(RecordService.ACTION_TOGGLE);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT
                | PendingIntent.FLAG_IMMUTABLE;
        PendingIntent pi = PendingIntent.getService(ctx, 0, intent, flags);
        views.setOnClickPendingIntent(R.id.btn_record, pi);
        views.setOnClickPendingIntent(R.id.widget_title, pi);
        views.setOnClickPendingIntent(R.id.widget_status, pi);
        return views;
    }

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        boolean recording = RecordService.isRecording();
        RemoteViews views = buildViews(ctx, recording);
        for (int id : ids) {
            mgr.updateAppWidget(id, views);
        }
    }
}
