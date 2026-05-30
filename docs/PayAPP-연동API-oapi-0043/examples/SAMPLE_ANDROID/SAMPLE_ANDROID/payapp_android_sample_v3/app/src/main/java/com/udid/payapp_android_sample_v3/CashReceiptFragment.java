package com.udid.payapp_android_sample_v3;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;

import androidx.fragment.app.Fragment;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.EditText;
import android.widget.RadioButton;

import com.udid.applink.constValue.PAALConstValue;
import com.udid.applink.model.type.PAReqType;
import com.udid.payapp_android_sample_v3.dialog.CashCancelDialog;

import java.io.UnsupportedEncodingException;
import java.net.URLEncoder;
import java.text.SimpleDateFormat;
import java.util.Date;

/**
 * Create by 김진원
 *
 */
public class CashReceiptFragment extends Fragment {

    public final static String RETURN_URI = "payappsamplev3://payment.result";

    RadioButton trCode0RBtn, trCode1RBtn, taxRBtn, taxFreeRBtn;

    EditText tradTimeETxt, idInfoETxt, nameETxt, goodsNameETxt, priceETxt, svcETxt, emailETxt, var1ETxt, var2ETxt;

    @Override
    public View onCreateView(LayoutInflater inflater, ViewGroup container,
                             Bundle savedInstanceState) {

        ViewGroup rootView = (ViewGroup) inflater.inflate(
                R.layout.fragment_cash_receipt, container, false);

        trCode0RBtn = rootView.findViewById(R.id.trCode0RBtn);
        trCode1RBtn = rootView.findViewById(R.id.trCode1RBtn);

        tradTimeETxt = rootView.findViewById(R.id.tradTimeETxt);
        idInfoETxt = rootView.findViewById(R.id.idInfoETxt);
        nameETxt = rootView.findViewById(R.id.nameETxt);
        goodsNameETxt = rootView.findViewById(R.id.goodsNameETxt);
        priceETxt = rootView.findViewById(R.id.priceETxt);
        svcETxt = rootView.findViewById(R.id.svcETxt);
        emailETxt = rootView.findViewById(R.id.emailETxt);
        var1ETxt = rootView.findViewById(R.id.var1ETxt);
        var2ETxt = rootView.findViewById(R.id.var2ETxt);

        taxRBtn = rootView.findViewById(R.id.taxRBtn);
        taxFreeRBtn = rootView.findViewById(R.id.taxFreeRBtn);

        SimpleDateFormat dateFormat = new SimpleDateFormat ("yyyyMMddHHmmss");
        tradTimeETxt.setText(dateFormat.format (new Date()));



        // 현금영수증 취소
        rootView.findViewById(R.id.cashReceiptCancelBtn).setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                CashCancelDialog cashCancelDialog = new CashCancelDialog(getContext(), new CashCancelDialog.IEventListener() {
                    @Override
                    public void cancel(String cashstno) {
                        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(cashReceiptCancelMakeParam(PAReqType.CASH_RECEIPT_CANCEL, cashstno)));
                        startActivity(intent);
                    }
                });
                cashCancelDialog.show();
            }
        });


        // 현금영수증 발행
        rootView.findViewById(R.id.cashReceiptDoneBtn).setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {

                Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(cashReceiptMakeParam(PAReqType.CASH_RECEIPT)));
                startActivity(intent);
            }
        });

        return rootView;
    }

    /** 사업자만 현금영수증 발행이 가능하며, 개인은 불가능합니다.
     * 현금영수증 발행
     * reqType : 발행 = CASH_RECEIPT
     * returnUri : 리턴받을 고객사 앱 URI
     * trCode : 소득공제용: 0, 지출증빙용: 1
     * tradeTime : 원거래시각 [YYYYMMDDHHMMSS]
     * idInfo : 소득공제용 발행 시: 휴대폰번호 / 지출증빙용 발행 시: 사업자번호
     * name : 구매자 또는 사업자 명
     * goodName : 상품명
     * goodPrice : 발행 요청 금액
     * email : 주문자 이메일
     * svc : 봉사료
     * hasTax : 과세/면세 [과세:1, 면세:0]
     * var1, var2 : 임의 사용 변수 1, 2
     */
    private String cashReceiptMakeParam(PAReqType paReqType) {

        String param = "";
        try {
            param += PAALConstValue.PAYAPP_APP_LINK
                    + "?reqType=" + URLEncoder.encode(paReqType.getVal(), "utf-8")
                    + "&returnUri=" + URLEncoder.encode(RETURN_URI, "utf-8")
                    + "&trCode=" + (trCode0RBtn.isChecked() ? "0" : "1")
                    + "&tradeTime=" + URLEncoder.encode(tradTimeETxt.getText().toString(), "utf-8")
                    + "&idInfo=" + URLEncoder.encode(idInfoETxt.getText().toString(), "utf-8")
                    + "&name=" + URLEncoder.encode(nameETxt.getText().toString(), "utf-8")
                    + "&goodName=" + URLEncoder.encode(goodsNameETxt.getText().toString(), "utf-8")
                    + "&goodPrice=" + URLEncoder.encode(priceETxt.getText().toString(), "utf-8")
                    + "&svc=" + URLEncoder.encode(svcETxt.getText().toString(), "utf-8")
                    + "&email=" + URLEncoder.encode(emailETxt.getText().toString(), "utf-8")
                    + "&hasTax=" + (taxRBtn.isChecked() ? PAALConstValue.TRUE_STR : PAALConstValue.FALSE_STR)
                    + "&var1=" + URLEncoder.encode(var1ETxt.getText().toString(), "utf-8")
                    + "&var2=" + URLEncoder.encode(var2ETxt.getText().toString(), "utf-8");
        } catch (UnsupportedEncodingException e) {
            e.printStackTrace();
        }

        return param;
    }

    /**
     * 현금영수증 발행 취소
     * reqType : 취소 = CASH_RECEIPT_CANCEL
     * returnUri : 리턴받을 고객사 앱 URI
     * cashstno : 현금영수증 발행 번호
     * var1, var2 : 임의 사용 변수 1, 2
     */
    private String cashReceiptCancelMakeParam(PAReqType paReqType, String cashstno) {

        String param = "";
        try {
            param += PAALConstValue.PAYAPP_APP_LINK
                    + "?reqType=" + URLEncoder.encode(paReqType.getVal(), "utf-8")
                    + "&returnUri=" + URLEncoder.encode(RETURN_URI, "utf-8")
                    + "&cashstno=" + URLEncoder.encode(cashstno, "utf-8")
                    + "&var1=" + URLEncoder.encode(var1ETxt.getText().toString(), "utf-8")
                    + "&var2=" + URLEncoder.encode(var2ETxt.getText().toString(), "utf-8");
        } catch (UnsupportedEncodingException e) {
            e.printStackTrace();
        }

        return param;
    }

}