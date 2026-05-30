package com.udid.payapp_android_sample_v3;

import android.app.AlertDialog;
import android.content.DialogInterface;
import android.content.Intent;
import android.os.Bundle;
import android.view.View;

import androidx.appcompat.app.AppCompatActivity;

import com.udid.applink.model.PAPaymentResponseData;
import com.udid.applink.model.PARemoteReqeustResponseData;
import com.udid.oapi.view.PAWebView;


/*******************************************************************************************
 *
 * Payapp_AppToApp Library는 참고용 가이드앱입니다.
 * 필수가 아닌 참고용이니 개발자 센터[https://payapp.kr/dev_center/dev_center01.html]를 이용하여 구현해 주세요.
 *
 *******************************************************************************************/

public class WebToAppActivity extends AppCompatActivity {

    PAWebView paWebView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_web_to_app);

        paWebView = findViewById(R.id.paWebView);
        paWebView.init(this);
        paWebView.setPAWebViewClient();
        paWebView.loadUrl("file:///android_asset/index.html");

        findViewById(R.id.closeBtn).setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                finish();
            }
        });
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);

        if (intent.getData() != null) {

            AlertDialog.Builder builder = new AlertDialog.Builder(this);
            builder.setTitle("결과값").setMessage(intent.getData().toString());
            builder.setNegativeButton("닫기", new DialogInterface.OnClickListener(){
                @Override
                public void onClick(DialogInterface dialog, int id)
                {
                }
            });
            AlertDialog alertDialog = builder.create();
            alertDialog.show();
        }
    }

}