package com.udid.payapp_android_sample_v3;

import androidx.appcompat.app.AppCompatActivity;

import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.view.View;

/**
 * Create by 김진원
 */
public class MainActivity extends AppCompatActivity {

    Context context = this;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        /**
         * 페이앱을 연동한 App Link 결제
         */
        findViewById(R.id.appLinkBtn).setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                startActivity(new Intent(context, AppLinkActivity.class));
            }
        });

        /**
         * Open Api 연동
         */
        findViewById(R.id.restOApiBtn).setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                startActivity(new Intent(context, OAPIActivity.class));
            }
        });

        /**
         * Web To App 결제
         */
        findViewById(R.id.webToAppBtn).setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                startActivity(new Intent(context, WebToAppActivity.class));
            }
        });
    }
}