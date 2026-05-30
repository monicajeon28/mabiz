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
import android.widget.Switch;

import com.udid.applink.constValue.PAALConstValue;
import com.udid.applink.model.type.PAReqType;

import java.io.UnsupportedEncodingException;
import java.net.URLEncoder;

/**
 * Create by 김진원
 *
 */
public class PaymentFragment extends Fragment implements View.OnClickListener{

    public final static String RETURN_URI = "payappsamplev3://payment.result";
    public final static String FEEDBACK_URL = "https://AOS_feedbackUrl.kr";
    public final static String CHECK_RETRY = "y";

    EditText phoneNumberETxt, goodsNameETxt, priceETxt, cardinstETxt, var1ETxt, var2ETxt;

    // 과세, 면세
    RadioButton taxRBtn, taxFreeRBtn;

    // 모든결제타입사용 여부
    Switch isAllPayReqTypeSch;

    PAReqType currentPaReqType;

    @Override
    public View onCreateView(LayoutInflater inflater, ViewGroup container,
                             Bundle savedInstanceState) {

        ViewGroup rootView = (ViewGroup) inflater.inflate(
                R.layout.fragment_payment, container, false);

        phoneNumberETxt = rootView.findViewById(R.id.phoneNumberETxt);
        goodsNameETxt = rootView.findViewById(R.id.goodsNameETxt);
        priceETxt = rootView.findViewById(R.id.priceETxt);
        cardinstETxt = rootView.findViewById(R.id.cardinstETxt);
        var1ETxt = rootView.findViewById(R.id.var1ETxt);
        var2ETxt = rootView.findViewById(R.id.var2ETxt);

        isAllPayReqTypeSch = rootView.findViewById(R.id.isAllPayReqTypeSch);

        taxRBtn = rootView.findViewById(R.id.taxRBtn);
        taxFreeRBtn = rootView.findViewById(R.id.taxFreeRBtn);

        rootView.findViewById(R.id.payappRemotePaymentBtn).setOnClickListener(this);
        rootView.findViewById(R.id.payappOcrPaymentBtn).setOnClickListener(this);
        rootView.findViewById(R.id.payappManualPaymentBtn).setOnClickListener(this);
        rootView.findViewById(R.id.payappNaverPayPaymentBtn).setOnClickListener(this);
        rootView.findViewById(R.id.payappKakaoPayPaymentBtn).setOnClickListener(this);
        rootView.findViewById(R.id.payappSmilePayPaymentBtn).setOnClickListener(this);
        rootView.findViewById(R.id.payappApplePayPaymentBtn).setOnClickListener(this);
        rootView.findViewById(R.id.payappPaycoPaymentBtn).setOnClickListener(this);
        rootView.findViewById(R.id.payappWechatPayPaymentBtn).setOnClickListener(this);
        rootView.findViewById(R.id.payappMyaccountPaymentBtn).setOnClickListener(this);
        rootView.findViewById(R.id.payappTossPayPaymentBtn).setOnClickListener(this);
        rootView.findViewById(R.id.payappQRPaymentBtn).setOnClickListener(this);
        rootView.findViewById(R.id.payappNfcPaymentBtn).setOnClickListener(this);
        rootView.findViewById(R.id.payappSamsungPaymentBtn).setOnClickListener(this);

        return rootView;
    }

    /**
     * 원격결제 및 대면결제
     * reqType : 원격결제 = REMOTE
     *           카메라 = OCR
     *           수기 = MANUAL
     *           네이버페이 = NAVER_PAY
     *           카카오페이 = KAKAO_PAY
     *           스마일페이 = SMILE_PAY
     *           애플페이 = APPLE_PAY
     *           페이코 = PAYCO
     *           위챗페이 = WECHAT_PAY
     *           내통장결제 = MY_ACCOUNT
     *           토스페이 = TOSS_PAY
     *           QR = QR
     *           NFC = NFC
     *           삼성페이 = SAMSUNG
     * returnUri : 리턴받을 고객사 앱 URI
     * phoneNumber : 수신 전화번호 (* 원격결제 필수, * 대면결제 10만원 이상 시 필수)
     * goodName : 상품명
     * goodPrice : 상품 가격 (* 1,000원이상 부터 가능, * 내통장결제는 10,000원이상 부터 가능)
     * cardinst : 할부 [1~12] * 5만원 이상부터 가능 (카메라, 수기, NFC, 삼성페이) 미입력 시 일시불
     * hasTax : 과세/면세 [과세:1, 면세:0] * 개인인 경우 면세
     * isAllPayReqType : 모든결제 사용 여부 [0:미사용, 1: 사용]
     * feedbackurl : 결제 결과 값을 받을 고객사 URL (결과값을 받아 DB에 저장한다. 공통 통보 URL 등록 시 중복 호출되니, 중복처리 되지 않도록 mul_no를 이용하여 중복 방지.)
     * checkretry : feedbackurl 재시도 [y:재시도,n:재시도 안함]
     * var1, var2 : 임의 사용 변수 1, 2
     */
    private String makeParam(PAReqType paReqType) {
        currentPaReqType = paReqType;

        String phone = null != phoneNumberETxt.getText() ? phoneNumberETxt.getText().toString():"";

        String param = "";
        try {
            param += PAALConstValue.PAYAPP_APP_LINK
                    + "?reqType=" + URLEncoder.encode(paReqType.getVal(), "utf-8")
                    + "&returnUri=" + URLEncoder.encode(RETURN_URI, "utf-8")
                    + "&phoneNumber=" + URLEncoder.encode(phone, "utf-8")
                    + "&goodName=" + URLEncoder.encode(goodsNameETxt.getText().toString(), "utf-8")
                    + "&goodPrice=" + URLEncoder.encode(priceETxt.getText().toString(), "utf-8")
                    + addCardinst(paReqType)
                    + "&hasTax=" + (taxRBtn.isChecked() ? PAALConstValue.TRUE_STR : PAALConstValue.FALSE_STR)
                    + addIsAllPayReqType(paReqType)
                    + "&feedbackurl=" + URLEncoder.encode(FEEDBACK_URL, "utf-8")
                    + "&checkretry=" + URLEncoder.encode(CHECK_RETRY, "utf-8")
                    + "&var1=" + URLEncoder.encode(var1ETxt.getText().toString(), "utf-8")
                    + "&var2=" + URLEncoder.encode(var2ETxt.getText().toString(), "utf-8");
        } catch (UnsupportedEncodingException e) {
            e.printStackTrace();
        }

        return param;
    }

    /**
     * 할부 [1~12 개월] (5만원 이상부터 가능) 카메라, 수기, NFC, 삼성페이
     */
    private String addCardinst(PAReqType paReqType) {
        String param = "";

        if (paReqType == PAReqType.OCR ||
                paReqType == PAReqType.MANUAL ||
                paReqType == PAReqType.NFC ||
                paReqType == PAReqType.SAMSUNG) {
            param = "&cardinst=" + cardinstETxt.getText().toString();
        }

        return param;
    }

    /**
     * 모튼 결제 선택 가능 처리
     */
    private String addIsAllPayReqType(PAReqType paReqType) {
        String param = "";

        if (paReqType == PAReqType.OCR ||
                paReqType == PAReqType.MANUAL ||
                paReqType == PAReqType.NAVER_PAY ||
                paReqType == PAReqType.KAKAO_PAY ||
                paReqType == PAReqType.SMILE_PAY ||
                paReqType == PAReqType.APPLE_PAY ||
                paReqType == PAReqType.PAYCO ||
                paReqType == PAReqType.WECHAT_PAY ||
                paReqType == PAReqType.MY_ACCOUNT ||
                paReqType == PAReqType.TOSS_PAY ||
                paReqType == PAReqType.QR ||
                paReqType == PAReqType.NFC ||
                paReqType == PAReqType.SAMSUNG) {
            param = "&isAllPayReqType=" + (isAllPayReqTypeSch.isChecked() ? PAALConstValue.TRUE_STR : PAALConstValue.FALSE_STR);
        }

        return param;
    }

    @Override
    public void onClick(View v) {
        int id = v.getId();

        // 원격결제
        if (id == R.id.payappRemotePaymentBtn) {
            payappRequest(makeParam(PAReqType.REMOTE));
        }

        // 카메라 결제
        else if (id == R.id.payappOcrPaymentBtn) {
            payappRequest(makeParam(PAReqType.OCR));
        }

        // 수기결제
        else if (id == R.id.payappManualPaymentBtn) {
            payappRequest(makeParam(PAReqType.MANUAL));
        }

        // 네이버페이
        else if (id == R.id.payappNaverPayPaymentBtn) {
            payappRequest(makeParam(PAReqType.NAVER_PAY));
        }

        // 카카오페이
        else if (id == R.id.payappKakaoPayPaymentBtn) {
            payappRequest(makeParam(PAReqType.KAKAO_PAY));
        }

        // 스마일페이
        else if (id == R.id.payappSmilePayPaymentBtn) {
            payappRequest(makeParam(PAReqType.SMILE_PAY));
        }

        // 애플페이
        else if (id == R.id.payappApplePayPaymentBtn) {
            payappRequest(makeParam(PAReqType.APPLE_PAY));
        }

        // 페이코
        else if (id == R.id.payappPaycoPaymentBtn) {
            payappRequest(makeParam(PAReqType.PAYCO));
        }

        // 위챗페이
        else if (id == R.id.payappWechatPayPaymentBtn) {
            payappRequest(makeParam(PAReqType.WECHAT_PAY));
        }

        // 내통장결제
        else if (id == R.id.payappMyaccountPaymentBtn) {
            payappRequest(makeParam(PAReqType.MY_ACCOUNT));
        }

        // 토스페이
        else if (id == R.id.payappTossPayPaymentBtn) {
            payappRequest(makeParam(PAReqType.TOSS_PAY));
        }

        // QR
        else if (id == R.id.payappQRPaymentBtn) {
            payappRequest(makeParam(PAReqType.QR));
        }

        // NFC결제(카드)
        else if (id == R.id.payappNfcPaymentBtn) {
            payappRequest(makeParam(PAReqType.NFC));
        }

        // NFC결제(삼성)
        else if (id == R.id.payappSamsungPaymentBtn) {
            payappRequest(makeParam(PAReqType.SAMSUNG));
        }
    }

    /**
     * 페이앱으로 결제 요청
     */
    void payappRequest(String data) {

        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(data));
        startActivity(intent);
    }

}