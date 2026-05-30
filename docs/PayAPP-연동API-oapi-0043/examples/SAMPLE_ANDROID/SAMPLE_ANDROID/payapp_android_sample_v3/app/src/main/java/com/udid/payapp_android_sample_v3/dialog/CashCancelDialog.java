package com.udid.payapp_android_sample_v3.dialog;

import android.app.Dialog;
import android.content.Context;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ListView;

import androidx.annotation.NonNull;

import com.udid.oapi.data.embed.PABillData;
import com.udid.payapp_android_sample_v3.R;

import java.util.List;

public class CashCancelDialog extends Dialog {

    Context context;

    IEventListener iEventListener;
    public interface IEventListener {
        public void cancel(String cashstno);
    }



    public CashCancelDialog(@NonNull Context context, IEventListener iEventListener) {
        super(context);
        this.context = context;
        this.iEventListener = iEventListener;
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.dialog_cash_cancel);

        getWindow().setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));


        EditText cashstnoEt = (EditText)findViewById(R.id.cashstnoEt);

        findViewById(R.id.cancelDialog).setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                iEventListener.cancel(cashstnoEt.getText().toString());
                dismiss();
            }
        });

        findViewById(R.id.closeDialog).setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                dismiss();
            }
        });
    }

}
