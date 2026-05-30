package com.udid.payapp_android_sample_v3.dialog;

import android.app.Dialog;
import android.content.Context;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.udid.oapi.PayAppOAPI;
import com.udid.oapi.data.PABillRegisterData;
import com.udid.oapi.data.PABillRegisterResponseData;
import com.udid.oapi.data.PABillResoponseData;
import com.udid.oapi.data.embed.PABillData;
import com.udid.oapi.sv.handler.PAResultHandler;
import com.udid.payapp_android_sample_v3.R;

public class BillRegisterDialog extends Dialog {

    Context context;

    EditText userIDETxt, cardNoETxt, expMonthETxt, expYearETxt, buyerAuthNoETxt, cardPwETxt, buyerPhoneETxt, buyerNameETxt;
    Button billRegisterDialog;

    String userID;


    public interface OnRegistListener {
        void onRegist(PABillData paBillData);
    }
    private OnRegistListener onRegistListener;
    public void setOnRegistListener(OnRegistListener onRegistListener) {
        this.onRegistListener = onRegistListener;
    }


    public BillRegisterDialog(@NonNull Context context) {
        super(context);
        this.context = context;
    }

    public BillRegisterDialog(@NonNull Context context, int themeResId) {
        super(context, themeResId);
        this.context = context;
    }

    protected BillRegisterDialog(@NonNull Context context, boolean cancelable, @Nullable OnCancelListener cancelListener) {
        super(context, cancelable, cancelListener);
        this.context = context;
    }

    public void setUserID(String userID){
        this.userID = userID;
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.dialog_bill_register);

        getWindow().setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));

        userIDETxt = findViewById(R.id.userIDETxt);
        cardNoETxt = findViewById(R.id.cardNoETxt);
        expMonthETxt = findViewById(R.id.expMonthETxt);
        expYearETxt = findViewById(R.id.expYearETxt);
        buyerAuthNoETxt = findViewById(R.id.buyerAuthNoETxt);
        cardPwETxt = findViewById(R.id.cardPwETxt);
        buyerPhoneETxt = findViewById(R.id.buyerPhoneETxt);
        buyerNameETxt = findViewById(R.id.buyerNameETxt);

        userIDETxt.setText(userID);

        billRegisterDialog = findViewById(R.id.billRegisterDialog);
        billRegisterDialog.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                billRegister();
            }
        });
    }

    private void billRegister() {
        String userID = userIDETxt.getText().toString();
        String cardNo = cardNoETxt.getText().toString();
        String expMonth = expMonthETxt.getText().toString();
        String expYear = expYearETxt.getText().toString();
        String buyerAuthNo = buyerAuthNoETxt.getText().toString();
        String cardPw = cardPwETxt.getText().toString();
        String buyerPhone = buyerPhoneETxt.getText().toString();
        String buyerName = buyerNameETxt.getText().toString();

        if (userID.isEmpty()) {
            Toast.makeText(context, "유저 아이디를 확인해주세요.", Toast.LENGTH_LONG).show();
            return;
        }

        if (cardNo.isEmpty()) {
            Toast.makeText(context, "카드번호를 확인해주세요.", Toast.LENGTH_LONG).show();
            return;
        }

        if (expMonth.isEmpty()) {
            Toast.makeText(context, "유효기간(월)을 확인해주세요.", Toast.LENGTH_LONG).show();
            return;
        }

        if (expYear.isEmpty()) {
            Toast.makeText(context, "유효기간(년)을 확인해주세요.", Toast.LENGTH_LONG).show();
            return;
        }

        if (buyerAuthNo.isEmpty()) {
            Toast.makeText(context, "인증번호를 확인해주세요.", Toast.LENGTH_LONG).show();
            return;
        }

        if (cardPw.isEmpty()) {
            Toast.makeText(context, "카드 비밀번호를 확인해주세요.", Toast.LENGTH_LONG).show();
            return;
        }

        if (buyerPhone.isEmpty()) {
            Toast.makeText(context, "구매자 전화번호를 확인해주세요.", Toast.LENGTH_LONG).show();
            return;
        }

        if (buyerName.isEmpty()) {
            Toast.makeText(context, "구매자 성함을 확인해주세요.", Toast.LENGTH_LONG).show();
            return;
        }

        PABillRegisterData data = PABillRegisterData.builder(userID, cardNo, expMonth, expYear, buyerAuthNo, cardPw, buyerPhone, buyerName).build();
        PayAppOAPI.create().billRegister(data, new PAResultHandler<PABillRegisterResponseData>() {
            @Override
            public void response(PABillRegisterResponseData result) {
                if (result.getState().equals("1")) {
                    Toast.makeText(context, "등록결제(BILL) 등록 성공", Toast.LENGTH_SHORT).show();

                    PABillData paBillData = new PABillData();
                    paBillData.setUserId(userID);
                    paBillData.setBuyerName(buyerName);
                    paBillData.setRecvPhone(buyerPhone);

                    PABillResoponseData billResoponseData = new PABillResoponseData();
                    billResoponseData.setEncBill(result.getEncBill());
                    billResoponseData.setBillAuthNo(result.getBillAuthNo());
                    billResoponseData.setCardno(result.getCardno());
                    billResoponseData.setCardname(result.getCardname());
                    paBillData.setBillResoponseData(billResoponseData);

                    onRegistListener.onRegist(paBillData);
                } else {
                    Toast.makeText(context, result.getErrorMessage(), Toast.LENGTH_SHORT).show();
                }
            }
        });
    }

}
