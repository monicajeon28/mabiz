package com.udid.payapp_android_sample_v3;

import android.app.DatePickerDialog;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.widget.DatePicker;
import android.widget.EditText;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;


import com.udid.oapi.PAOAPIConstValue;
import com.udid.oapi.PayAppOAPI;
import com.udid.oapi.data.PACashStCancelData;
import com.udid.oapi.data.PACashStCnResponseData;
import com.udid.oapi.data.PACashStRegistData;
import com.udid.oapi.data.PACashStResponseData;
import com.udid.oapi.data.PACheckNpayCashReceiptReqData;
import com.udid.oapi.data.PACheckNpayCashReceiptReqResponseData;
import com.udid.oapi.data.PAPayCancelData;
import com.udid.oapi.data.PAPayCancelReqData;
import com.udid.oapi.data.PAPayCancelReqResponseData;
import com.udid.oapi.data.PAPayCancelResponseData;
import com.udid.oapi.data.PAPayRequestData;
import com.udid.oapi.data.PAPayRequestResponseData;
import com.udid.oapi.data.PARebillCancelData;
import com.udid.oapi.data.PARebillCancelResponseData;
import com.udid.oapi.data.PARebillRegistData;
import com.udid.oapi.data.PARebillRegistResponseData;
import com.udid.oapi.data.PARebillStartData;
import com.udid.oapi.data.PARebillStartResponseData;
import com.udid.oapi.data.PARebillStopData;
import com.udid.oapi.data.PARebillStopResponseData;
import com.udid.oapi.data.PASellerRegistData;
import com.udid.oapi.data.PASellerRegistResponseData;
import com.udid.oapi.data.PASubidRegistData;
import com.udid.oapi.data.PASubidRegistResponseData;
import com.udid.oapi.data.PAUseridCheckData;
import com.udid.oapi.data.PAUseridCheckResponseData;
import com.udid.oapi.data.embed.PABillData;
import com.udid.oapi.lib.PADataLib;
import com.udid.oapi.sv.handler.PAResultHandler;
import com.udid.payapp_android_sample_v3.dialog.BillListDialog;
import com.udid.payapp_android_sample_v3.dialog.BillRegisterDialog;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;

/**
 * Create by 김진원
 */

/*******************************************************************************************
 *
 * Payapp_OAPI Library는 참고용 가이드앱입니다.
 * 필수가 아닌 참고용이니 개발자 센터[https://payapp.kr/dev_center/dev_center01.html]를 이용하여 구현해 주세요.
 *
 *******************************************************************************************/
public class OAPIActivity extends AppCompatActivity implements View.OnClickListener {

    public final static String RETURN_URI = "payappsamplev3://payment.result";

    /**************************************
     * Payapp_OAPI 앱 사용을 위한 필수값 체크
     *************************************/

    /** 페이앱 아이디 */
    String userId = "ninano0907";

    /** 연동 KEY, 해당 링크에서 가져오세요. [https://seller.payapp.kr/c/apiconnect_info] */
    String linkKey = "IYijcQPxTHsxMw8kty9emO1DPJnCCRVaOgT+oqg6zaM=";

    /** 전화번호 */
    String recvPhone = "01073921546";

    /** 이메일 */
    String email = "ninano0907@naver.com";

    /** 정기결제 요청 날짜(*오늘 이후 날짜) 0000-00-00 */
    String rebillExpire = "0000-00-00";

    Context context = this;

    /** mul_no, rebill_no, cashstno는 원활한 샘플앱 구동을 위한 변수입니다. */
    // 결제요청번호
    String mul_no = null;
    // 정기결제 등록번호
    String rebill_no = null;
    // 현금영수증 발행번호
    String cashstno = null;
    // 등록결제(BILL) 리스트에 사용되는 변수
    List<PABillData> paBillDataList = new ArrayList<>();

    EditText userIDETxt, linkKeyETxt, recvPhoneETxt, emailETxt, rebillExprieETxt;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_oapi);

        userIDETxt = (EditText) findViewById(R.id.userIDETxt);
        linkKeyETxt = (EditText) findViewById(R.id.linkKeyETxt);
        recvPhoneETxt = (EditText) findViewById(R.id.recvPhoneETxt);
        emailETxt = (EditText) findViewById(R.id.emailETxt);
        rebillExprieETxt = (EditText) findViewById(R.id.rebillExprieETxt);


        userIDETxt.setText(userId);
        linkKeyETxt.setText(linkKey);
        recvPhoneETxt.setText(recvPhone);
        emailETxt.setText(email);
        rebillExprieETxt.setText(rebillExpire);


        findViewById(R.id.linkKeyBtn).setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {

                Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(PAOAPIConstValue.LINK_KEY_URL));
                startActivity(intent);
            }
        });

        findViewById(R.id.rebillExprieBtn).setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {

                final Calendar c = Calendar.getInstance();
                DatePickerDialog dlgDate = new DatePickerDialog(context, new DatePickerDialog.OnDateSetListener() {
                    @Override
                    public void onDateSet(DatePicker view, int year, int month, int dayOfMonth) {

                        String date = year + "-" + String.format("%02d", month + 1) + "-" +  String.format("%02d", dayOfMonth);
                        rebillExprieETxt.setText(date);
                    }
                }, c.get(Calendar.YEAR), c.get(Calendar.MONTH), c.get(Calendar.DAY_OF_MONTH));
                dlgDate.getDatePicker().setMinDate(System.currentTimeMillis() - 1000);
                dlgDate.show();
            }
        });

        findViewById(R.id.reqPaymentBtn).setOnClickListener(this);
        findViewById(R.id.payCancelBtn).setOnClickListener(this);
        findViewById(R.id.paycancelreqBtn).setOnClickListener(this);
        findViewById(R.id.rebillRegistBtn).setOnClickListener(this);
        findViewById(R.id.rebillCancelBtn).setOnClickListener(this);
        findViewById(R.id.rebillStopBtn).setOnClickListener(this);
        findViewById(R.id.rebillStartBtn).setOnClickListener(this);
        findViewById(R.id.sellerRegistBtn).setOnClickListener(this);
        findViewById(R.id.useridCheckBtn).setOnClickListener(this);
        findViewById(R.id.subidregistBtn).setOnClickListener(this);
        findViewById(R.id.cashStBtn).setOnClickListener(this);
        findViewById(R.id.cashStCnBtn).setOnClickListener(this);
        findViewById(R.id.checkNpayCashReceiptReqBtn).setOnClickListener(this);
        findViewById(R.id.billRegisterBtn).setOnClickListener(this);
        findViewById(R.id.showBillList).setOnClickListener(this);
        findViewById(R.id.closeBtn).setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                finish();
            }
        });
    }

    /**
     * Payapp_OAPI 앱 사용을 위한 필수값 체크
     * 사용 할 API의 필수값이 아닐 시 수정 및 삭제하세요.
     * @return
     */
    private boolean checkVaild() {

        userId = userIDETxt.getText().toString();
        linkKey = linkKeyETxt.getText().toString();
        recvPhone = recvPhoneETxt.getText().toString();
        email = emailETxt.getText().toString();
        rebillExpire = rebillExprieETxt.getText().toString();

        if (userId.isEmpty() || linkKey.isEmpty() || recvPhone.isEmpty() || email.isEmpty() || rebillExpire.isEmpty()){
            Toast.makeText(context, "샘플 사용 전 필수값 입력하세요.\n[userId, linkKey, recvPhone, email, rebillExpire]", Toast.LENGTH_LONG).show();
            return false;
        }
        return true;
    }

    @Override
    public void onClick(View v) {
        if (!checkVaild()) return;

        int id = v.getId();
        // 결제 요청
        if (id == R.id.reqPaymentBtn) {
            payRequest();
        }

        // 결제 취소
        else if (id == R.id.payCancelBtn) {
            payCancel();
        }

        // 결제 취소 요청(결제승인 후 D+5일이 경과 되었거나, 판매자 정산이 완료된 경우)
        else if (id == R.id.paycancelreqBtn) {
            paycancelreq();
        }

        // 정기 결제 요청
        else if (id == R.id.rebillRegistBtn) {
            rebillRegist();
        }

        // 정기 결제 해지
        else if (id == R.id.rebillCancelBtn) {
            rebillCancel();
        }

        // 정기 결제 일시 정지
        else if (id == R.id.rebillStopBtn) {
            rebillStop();
        }

        // 정기 결제 승인
        else if (id == R.id.rebillStartBtn) {
            rebillStart();
        }

        // 판매자 회원가입
        else if (id == R.id.sellerRegistBtn) {
            sellerRegist();
        }

        // 판매자 아이디 중복 체크
        else if (id == R.id.useridCheckBtn) {
            useridCheck();
        }

        // 부계정 등록
        else if (id == R.id.subidregistBtn) {
            subidRegist();
        }

        // 현금영수증 발행
        else if (id == R.id.cashStBtn) {
            cashStRegist();
        }

        // 현금영수증 발행 취소
        else if (id == R.id.cashStCnBtn) {
            cashStCancel();
        }

        // 등록결제(BILL) 등록
        else if (id == R.id.billRegisterBtn) {
            billRegist();
        }

        // 등록결제(BILL) 리스트
        else if (id == R.id.showBillList) {
            showBillList();
        }

        // 네이버페이 현금 영수증 발행 대상 금액 조회
        else if (id == R.id.checkNpayCashReceiptReqBtn) {
            checkNpayCashReceiptReq();
        }
    }

    /**
     * 결제 요청

     ********** 시나리오 1 (구매자 핸드폰으로 결제 URL을 보내 결제를 요청한다.) ************************************************************************
     * payRequest() 함수로 결제 링크 생성 및 구매자 핸드폰으로 결제 링크 전송 -> 구매자 결제
     *
     * data.setSmsuse("y");         - 구매자에게 결제 문자를 보낸다.
     * data.setFeedbackurl("");     - 결제 결과 값을 받을 고객사 URL (결과값을 받아 DB에 저장한다.)
     **************************************************************************************************************************************

     ********** 시나리오 2 (결제 URL을 앱 내 WebView에 띄워 결제를 유도한다.) ************************************************************************
     * payRequest() 함수로 결제 링크 생성 -> WebView로 링크 실행 -> 결제 진행 -> 결제앱으로 이동하여 인증 -> WebView로 돌아와 내부적으로 결제 처리 -> Skip_cstpage에 따라 '결제 전표' 이동 또는 'Returnurl' 이동
     *
     * data.setSmsuse("n");         - 구매자에게 결제 문자를 보내지 않는다.
     * data.setFeedbackurl("");     - 결제 결과 값을 받을 고객사 URL (결과값을 받아 DB에 저장한다. 공통 통보 URL 등록 시 중복 호출되니, 중복처리 되지 않도록 mul_no를 이용하여 중복 방지.)
     * data.setSkip_cstpage("y");   - 'y' : 매출 전표 이동 없이 바로 Returnurl로 이동 (결제 데이터를 POST로 전송, 보안을 위해 결제완료 DB처리는 feedbackurl 페이지에서 한다.)
     *                                'n' : 매출 전표로 이동 (결제 데이터 전송 안 함, 확인 버튼 클릭시 Returnurl로 이동)
     * data.setReturnurl("");       - 결제 완료 후 이동 할 화면 URL. ex)앱제작사의 커스텀 매출전표, 결제 완료 화면
     *                                페이앱 연동은 끝났습니다. 해당 페이지에서 Javascript 또는 네이티브로 앱을 컨트롤 하세요.
     **************************************************************************************************************************************
     */
    private void payRequest() {

        PAPayRequestData data = PAPayRequestData.builder(userId, "테스트 상품", "1000", recvPhone).build();

        data.setSmsuse("n");

        // 앱카드에서 인증 후 해당 앱을 호출 할때 사용.(앱카드 정책에 따라 정상 작동 안 할 수 있음)
        data.setAppurl(RETURN_URI);

        /**
         data.setFeedbackurl("");
         data.setReturnurl("");
         data.setSkip_cstpage("n");
         */

        /**
         * currency가 usd일 경우 필수
         */
//        data.setVccode("국제전화 국가번호");

        PayAppOAPI.create().payRequest(data, new PAResultHandler<PAPayRequestResponseData>() {
            @Override
            public void response(PAPayRequestResponseData result) {
                if (result.getState().equals("1")) {

                    System.out.println("result.getPayurl() :: " + result.getPayurl());
                    Toast.makeText(context, "결제 요청 성공", Toast.LENGTH_SHORT).show();
                    mul_no = result.getMul_no();

                    // 앱 내 웹뷰를 이용한 결제 요청.
                    Intent intent = new Intent(context, WebActivity.class);
                    intent.putExtra("url", result.getPayurl());
                    context.startActivity(intent);

                } else {
                    Toast.makeText(context, result.getErrorMessage(), Toast.LENGTH_SHORT).show();
                }
            }
        });
    }

    /**
     * 결제(요청, 승인)취소
     */
    private void payCancel() {

        if (null == mul_no) {
            Toast.makeText(context, "결제 후 취소하세요", Toast.LENGTH_SHORT).show();
            return;
        }

        PAPayCancelData data = PAPayCancelData.builder(userId, linkKey, mul_no).build();

        /**
         * 부분취소인 경우 필수(partcancel (0:전취소, 1:부분취소))
         */
//        data.setCancelprice("결제요청취소 금액");

        PayAppOAPI.create().payCancel(data, new PAResultHandler<PAPayCancelResponseData>() {
            @Override
            public void response(PAPayCancelResponseData result) {
                if (result.getState().equals("1")) {
                    Toast.makeText(context, "결제 취소 성공", Toast.LENGTH_SHORT).show();
                    mul_no = null;
                } else {
                    Toast.makeText(context, result.getErrorMessage(), Toast.LENGTH_SHORT).show();
                }
            }
        });
    }

    /**
     * 결제 취소 요청 (결제승인 후 D+5일이 경과 되었거나, 판매자 정산이 완료된 경우)
     */
    private void paycancelreq() {

        if (null == mul_no) {
            Toast.makeText(context, "결제 후 취소 요청 하세요", Toast.LENGTH_SHORT).show();
            return;
        }

        PAPayCancelReqData data = PAPayCancelReqData.builder(userId, linkKey, mul_no, "취소 메모").build();

        /**
         * 부분취소인 경우 필수(partcancel (0:전취소, 1:부분취소))
         */
//        data.setCancelprice("결제요청취소 금액");

        PayAppOAPI.create().payCancelReq(data, new PAResultHandler<PAPayCancelReqResponseData>() {
            @Override
            public void response(PAPayCancelReqResponseData result) {
                if (result.getState().equals("1")) {
                    Toast.makeText(context, "결제 취소 요청 성공", Toast.LENGTH_SHORT).show();
                    mul_no = null;
                } else {
                    Toast.makeText(context, result.getErrorMessage(), Toast.LENGTH_SHORT).show();
                }
            }
        });
    }

    /**
     * 정기 결제 요청
     */
    private void rebillRegist() {

        PARebillRegistData data = PARebillRegistData.builder(userId, "테스트 상품", "1000", recvPhone, "Month", rebillExpire).rebillCycleMonth("1").build();

        PayAppOAPI.create().rebillRegist(data, new PAResultHandler<PARebillRegistResponseData>() {
            @Override
            public void response(PARebillRegistResponseData result) {
                if (result.getState().equals("1")) {
                    Toast.makeText(context, "정기 결제 요청 성공", Toast.LENGTH_SHORT).show();
                    rebill_no = result.getRebill_no();
                } else {
                    Toast.makeText(context, result.getErrorMessage(), Toast.LENGTH_SHORT).show();
                }
            }
        });
    }

    /**
     * 정기 결제 해지
     */
    private void rebillCancel() {

        if (null == rebill_no) {
            Toast.makeText(context, "정기 결제 후 해지 하세요", Toast.LENGTH_SHORT).show();
            return;
        }

        PARebillCancelData data = PARebillCancelData.builder(userId, rebill_no, linkKey).build();

        PayAppOAPI.create().rebillCancel(data, new PAResultHandler<PARebillCancelResponseData>() {
            @Override
            public void response(PARebillCancelResponseData result) {
                if (result.getState().equals("1")) {
                    Toast.makeText(context, "정기 결제 해지 성공", Toast.LENGTH_SHORT).show();
                    rebill_no = null;
                } else {
                    Toast.makeText(context, result.getErrorMessage(), Toast.LENGTH_SHORT).show();
                }
            }
        });
    }

    /**
     * 정기 결제 일시 정지
     */
    private void rebillStop() {

        if (null == rebill_no) {
            Toast.makeText(context, "정기 결제 후 일시 정지 하세요", Toast.LENGTH_SHORT).show();
            return;
        }

        PARebillStopData data = PARebillStopData.builder(userId, rebill_no, linkKey).build();

        PayAppOAPI.create().rebillStop(data, new PAResultHandler<PARebillStopResponseData>() {
            @Override
            public void response(PARebillStopResponseData result) {
                if (result.getState().equals("1")) {
                    Toast.makeText(context, "정기 결제 일시 정지 성공", Toast.LENGTH_SHORT).show();
                    rebill_no = null;
                } else {
                    Toast.makeText(context, result.getErrorMessage(), Toast.LENGTH_SHORT).show();
                }
            }
        });
    }

    /**
     * 정기 결제 승인
     */
    private void rebillStart() {

        if (null == rebill_no) {
            Toast.makeText(context, "정기 결제 후 승인 하세요", Toast.LENGTH_SHORT).show();
            return;
        }

        PARebillStartData data = PARebillStartData.builder(userId, rebill_no, linkKey).build();

        PayAppOAPI.create().rebillStart(data, new PAResultHandler<PARebillStartResponseData>() {
            @Override
            public void response(PARebillStartResponseData result) {
                if (result.getState().equals("1")) {
                    Toast.makeText(context, "정기 결제 승인 성공", Toast.LENGTH_SHORT).show();
                    rebill_no = null;
                } else {
                    Toast.makeText(context, result.getErrorMessage(), Toast.LENGTH_SHORT).show();
                }
            }
        });
    }

    /**
     * 판매자 회원 가입
     */
    private void sellerRegist() {

        String userid = "";
        String userpwd = "";
        String sellername = "";
        String recvPhone = "";
        String email = "";

        if (userid.isEmpty() || userpwd.isEmpty() || sellername.isEmpty() || recvPhone.isEmpty() || email.isEmpty()) {
            Toast.makeText(context, "판매자 회원등록 정보를 확인해주세요.", Toast.LENGTH_SHORT).show();
            return;
        }

        PASellerRegistData data = PASellerRegistData.builder(userid, userpwd, sellername, recvPhone, email, "서비스구분", "1", "리셀러 아이디", "0", "seller").build();

        /**
         * usertype : 판매자 구분 (개인:1, 사업자:2)
         */

        // 개인 필수
        data.setUsername("이름");

        // 사업자 필수
//        data.setCompregno("사업자등록번호");
//        data.setCompname("상호명");
//        data.setBiztype1("업태");
//        data.setBiztype2("업종");
//        data.setCeo_nm("대표자 성함");

        PayAppOAPI.create().sellerRegist(data, new PAResultHandler<PASellerRegistResponseData>() {
            @Override
            public void response(PASellerRegistResponseData result) {
                if (result.getState().equals("1")) {
                    Toast.makeText(context, "판매자 회원 가입 성공", Toast.LENGTH_SHORT).show();
                } else {
                    Toast.makeText(context, result.getErrorMessage(), Toast.LENGTH_SHORT).show();
                }
            }
        });
    }

    /**
     * 판매자 회원 아이디 중복 체크
     */
    private void useridCheck() {

        String resllerid = "";

        if (resllerid.isEmpty() ) {
            Toast.makeText(context, "회원 정보를 확인해주세요.", Toast.LENGTH_SHORT).show();
            return;
        }

        PAUseridCheckData data = PAUseridCheckData.builder(userId,  resllerid).build();

        PayAppOAPI.create().useridCheck(data, new PAResultHandler<PAUseridCheckResponseData>() {
            @Override
            public void response(PAUseridCheckResponseData result) {
                if (result.getState().equals("1")) {
                    Toast.makeText(context, "판매자 회원 아이디 중복 체크 성공", Toast.LENGTH_SHORT).show();
                } else {
                    Toast.makeText(context, result.getErrorMessage(), Toast.LENGTH_SHORT).show();
                }
            }
        });
    }

    /**
     * 부계정 등록
     */
    private void subidRegist() {
        // TODO: 직접 입력
        String subuserid = "";
        String subpwd = "";
        String subname = "";

        if (subuserid.isEmpty() || subpwd.isEmpty() || subname.isEmpty()) {
            Toast.makeText(context, "부계정 등록 정보를 확인해주세요.", Toast.LENGTH_SHORT).show();
            return;
        }
        PASubidRegistData data = PASubidRegistData.builder(userId, subuserid, subpwd, subname).build();

        PayAppOAPI.create().subidRegist(data, new PAResultHandler<PASubidRegistResponseData>() {
            @Override
            public void response(PASubidRegistResponseData result) {
                if (result.getState().equals("1")) {
                    Toast.makeText(context, "부계정 등록 성공", Toast.LENGTH_SHORT).show();
                } else {
                    Toast.makeText(context, result.getErrorMessage(), Toast.LENGTH_SHORT).show();
                }
            }
        });
    }

    /**
     * 현금영수증 발행
     */
    private void cashStRegist() {

        PACashStRegistData data = PACashStRegistData.builder(userId, linkKey,"테스트 상품", "구매자명", recvPhone, PADataLib.getCurrentDateTime(), "0", "1000", "910", "0", "90", "TG01").build();

        PayAppOAPI.create().cashSt(data, new PAResultHandler<PACashStResponseData>() {
            @Override
            public void response(PACashStResponseData result) {
                if (result.getState().equals("1")) {
                    Toast.makeText(context, "현금영수증 발행 성공", Toast.LENGTH_SHORT).show();
                    cashstno = result.getCashstno();
                } else {
                    Toast.makeText(context, result.getErrorMessage(), Toast.LENGTH_SHORT).show();
                }
            }
        });
    }

    /**
     * 현금영수증 발행 취소
     */
    private void cashStCancel() {

        if (null == cashstno) {
            Toast.makeText(context, "현금영수증 발행 후 취소 하세요", Toast.LENGTH_SHORT).show();
            return;
        }

        PACashStCancelData data = PACashStCancelData.builder(userId, linkKey, cashstno).build();

        PayAppOAPI.create().cashStCn(data, new PAResultHandler<PACashStCnResponseData>() {
            @Override
            public void response(PACashStCnResponseData result) {
                if (result.getState().equals("1")) {
                    Toast.makeText(context, "현금영수증 발행 취소 성공", Toast.LENGTH_SHORT).show();
                    cashstno = null;
                } else {
                    Toast.makeText(context, result.getErrorMessage(), Toast.LENGTH_SHORT).show();
                }
            }
        });
    }

    /**
     * 네이버페이 현금영수증 발행대상 금액조회
     */
    private void checkNpayCashReceiptReq() {

        if (null == mul_no) {
            Toast.makeText(context, "결제 후 대상 조회 하세요", Toast.LENGTH_SHORT).show();
            return;
        }

        PACheckNpayCashReceiptReqData data = PACheckNpayCashReceiptReqData.builder(userId, mul_no).build();

        PayAppOAPI.create().checkNpayCashReceiptReq(data, new PAResultHandler<PACheckNpayCashReceiptReqResponseData>() {
            @Override
            public void response(PACheckNpayCashReceiptReqResponseData result) {
                if (result.getState().equals("1")) {
                    Toast.makeText(context, "네이버페이 현금영수증 발행대상 금액조회 성공", Toast.LENGTH_SHORT).show();

                } else {
                    Toast.makeText(context, result.getErrorMessage(), Toast.LENGTH_SHORT).show();
                }
            }
        });
    }

    /**
     * Bill 결제 등록
     */
    private void billRegist() {

        BillRegisterDialog billRegisterDialog = new BillRegisterDialog(context);
        billRegisterDialog.setUserID(userIDETxt.getText().toString());
        billRegisterDialog.setOnRegistListener(new BillRegisterDialog.OnRegistListener() {
            @Override
            public void onRegist(PABillData paBillData) {
                paBillDataList.add(paBillData);
            }
        });

        billRegisterDialog.show();
    }


    private void showBillList() {

        BillListDialog billListDialog = new BillListDialog(context, paBillDataList);
        billListDialog.show();
    }

}