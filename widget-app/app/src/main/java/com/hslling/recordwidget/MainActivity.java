package com.hslling.recordwidget;

import android.Manifest;
import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;

public class MainActivity extends AppCompatActivity {

    private final ActivityResultLauncher<String> micPerm =
            registerForActivityResult(new ActivityResultContracts.RequestPermission(), granted -> {
                if (!granted) {
                    Toast.makeText(this, R.string.toast_perm_denied, Toast.LENGTH_LONG).show();
                }
            });

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        int pad = (int) (24 * getResources().getDisplayMetrics().density);
        root.setPadding(pad, pad, pad, pad);

        TextView title = new TextView(this);
        title.setText(R.string.main_title);
        title.setTextSize(20f);
        title.setPadding(0, 0, 0, pad);

        TextView desc = new TextView(this);
        desc.setText(R.string.main_desc);
        desc.setTextSize(15f);
        desc.setLineSpacing(0, 1.4f);

        Button permBtn = new Button(this);
        permBtn.setText(R.string.main_perm_button);
        permBtn.setOnClickListener(v -> {
            if (hasMicPerm()) {
                Toast.makeText(this, "麦克风权限已授予", Toast.LENGTH_SHORT).show();
            } else {
                micPerm.launch(Manifest.permission.RECORD_AUDIO);
            }
        });

        Button addWidgetBtn = new Button(this);
        addWidgetBtn.setText("去添加小部件");
        addWidgetBtn.setOnClickListener(v -> {
            try {
                Intent i = new Intent();
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    i.setAction(AppWidgetManager.ACTION_APPWIDGET_PICK);
                } else {
                    i.setAction(Settings.ACTION_SETTINGS);
                }
                startActivity(i);
            } catch (Exception e) {
                Toast.makeText(this, "请手动在桌面长按添加小部件", Toast.LENGTH_LONG).show();
            }
        });

        root.addView(title);
        root.addView(desc);
        root.addView(permBtn);
        root.addView(addWidgetBtn);
        setContentView(root);

        if (!hasMicPerm()) {
            micPerm.launch(Manifest.permission.RECORD_AUDIO);
        }
    }

    private boolean hasMicPerm() {
        return ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
                == PackageManager.PERMISSION_GRANTED;
    }
}
