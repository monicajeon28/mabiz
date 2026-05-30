package com.udid.payapp_android_sample_v3;

import androidx.appcompat.app.AppCompatActivity;

import android.app.AlertDialog;
import android.content.Context;
import android.content.DialogInterface;
import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.EditText;
import android.widget.TextView;

import com.udid.applink.model.PAPaymentResponseData;
import com.udid.applink.model.PARemoteReqeustResponseData;
import com.udid.applink.model.type.PAReqType;

public class ResultActivity extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_result);

        TextView resultTv = (TextView) findViewById(R.id.resultTv);
        findViewById(R.id.closeBtn).setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                finish();
            }
        });


        /**
         * PARemoteReqeustResponseData : 원격 결제
         * PAPaymentResponseData : 원격 외 결제
         */
        Intent intent = getIntent();
        resultTv.setText(intent.getDataString());

    }
}