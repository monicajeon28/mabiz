package com.udid.oapi.sv;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.udid.oapi.PAOAPIConstValue;
import com.udid.oapi.data.PABillDeleteData;
import com.udid.oapi.data.PABillDeleteResponseData;
import com.udid.oapi.data.PABillPaymentData;
import com.udid.oapi.data.PABillPaymentResponseData;
import com.udid.oapi.data.PABillRegisterData;
import com.udid.oapi.data.PABillRegisterResponseData;
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
import com.udid.oapi.data.PAResponseData;
import com.udid.oapi.data.PASellerRegistData;
import com.udid.oapi.data.PASellerRegistResponseData;
import com.udid.oapi.data.PASubidRegistData;
import com.udid.oapi.data.PASubidRegistResponseData;
import com.udid.oapi.data.PAUseridCheckData;
import com.udid.oapi.data.PAUseridCheckResponseData;
import com.udid.oapi.sv.handler.PAResultHandler;

import java.io.IOException;

/**
 * Create by 김진원
 */

public class PayAppSvImp implements PayAppSv {

    private PayAppWebRequestManager payAppWebRequestManager = new PayAppWebRequestManager();

    @Override
    public void payRequest(PAPayRequestData data, PAResultHandler<PAPayRequestResponseData> paResultHandler) {
        payAppWebRequestManager.connection(PAOAPIConstValue.CMD_PAY_REQUEST, data, new PAResultHandler<PAResponseData>() {
            @Override
            public void response(PAResponseData result) {
                PAPayRequestResponseData responseData = null;
                try {
                    responseData = new ObjectMapper().readValue(result.getReturnJsonData(), PAPayRequestResponseData.class);
                } catch (IOException e) {
                    e.printStackTrace();
                }
                paResultHandler.response(responseData);
            }
        });
    }

    @Override
    public void payCancel(PAPayCancelData data, PAResultHandler<PAPayCancelResponseData> paResultHandler) {
        payAppWebRequestManager.connection(PAOAPIConstValue.CMD_PAY_CANCEL, data, new PAResultHandler<PAResponseData>() {
            @Override
            public void response(PAResponseData result) {
                PAPayCancelResponseData responseData = null;
                try {
                    responseData = new ObjectMapper().readValue(result.getReturnJsonData(), PAPayCancelResponseData.class);
                } catch (IOException e) {
                    e.printStackTrace();
                }
                paResultHandler.response(responseData);
            }
        });
    }

    @Override
    public void payCancelReq(PAPayCancelReqData data, PAResultHandler<PAPayCancelReqResponseData> paResultHandler) {
        payAppWebRequestManager.connection(PAOAPIConstValue.CMD_PAY_CANCEL_REQ, data, new PAResultHandler<PAResponseData>() {
            @Override
            public void response(PAResponseData result) {
                PAPayCancelReqResponseData responseData = null;
                try {
                    responseData = new ObjectMapper().readValue(result.getReturnJsonData(), PAPayCancelReqResponseData.class);
                } catch (IOException e) {
                    e.printStackTrace();
                }
                paResultHandler.response(responseData);
            }
        });
    }

    @Override
    public void rebillRegist(PARebillRegistData data, PAResultHandler<PARebillRegistResponseData> paResultHandler) {
        payAppWebRequestManager.connection(PAOAPIConstValue.CMD_REBILL_REGIST, data, new PAResultHandler<PAResponseData>() {
            @Override
            public void response(PAResponseData result) {
                PARebillRegistResponseData responseData = null;
                try {
                    responseData = new ObjectMapper().readValue(result.getReturnJsonData(), PARebillRegistResponseData.class);
                } catch (IOException e) {
                    e.printStackTrace();
                }
                paResultHandler.response(responseData);
            }
        });
    }

    @Override
    public void rebillCancel(PARebillCancelData data, PAResultHandler<PARebillCancelResponseData> paResultHandler) {
        payAppWebRequestManager.connection(PAOAPIConstValue.CMD_REBILL_CANCEL, data, new PAResultHandler<PAResponseData>() {
            @Override
            public void response(PAResponseData result) {
                PARebillCancelResponseData responseData = null;
                try {
                    responseData = new ObjectMapper().readValue(result.getReturnJsonData(), PARebillCancelResponseData.class);
                } catch (IOException e) {
                    e.printStackTrace();
                }
                paResultHandler.response(responseData);
            }
        });
    }

    @Override
    public void rebillStop(PARebillStopData data, PAResultHandler<PARebillStopResponseData> paResultHandler) {
        payAppWebRequestManager.connection(PAOAPIConstValue.CMD_REBILL_STOP, data, new PAResultHandler<PAResponseData>() {
            @Override
            public void response(PAResponseData result) {
                PARebillStopResponseData responseData = null;
                try {
                    responseData = new ObjectMapper().readValue(result.getReturnJsonData(), PARebillStopResponseData.class);
                } catch (IOException e) {
                    e.printStackTrace();
                }
                paResultHandler.response(responseData);
            }
        });
    }

    @Override
    public void rebillStart(PARebillStartData data, PAResultHandler<PARebillStartResponseData> paResultHandler) {
        payAppWebRequestManager.connection(PAOAPIConstValue.CMD_REBILL_START, data, new PAResultHandler<PAResponseData>() {
            @Override
            public void response(PAResponseData result) {
                PARebillStartResponseData responseData = null;
                try {
                    responseData = new ObjectMapper().readValue(result.getReturnJsonData(), PARebillStartResponseData.class);
                } catch (IOException e) {
                    e.printStackTrace();
                }
                paResultHandler.response(responseData);
            }
        });
    }

    @Override
    public void sellerRegist(PASellerRegistData data, PAResultHandler<PASellerRegistResponseData> paResultHandler) {
        payAppWebRequestManager.connection(PAOAPIConstValue.CMD_SELLER_REGIST, data, new PAResultHandler<PAResponseData>() {
            @Override
            public void response(PAResponseData result) {
                PASellerRegistResponseData responseData = null;
                try {
                    responseData = new ObjectMapper().readValue(result.getReturnJsonData(), PASellerRegistResponseData.class);
                } catch (IOException e) {
                    e.printStackTrace();
                }
                paResultHandler.response(responseData);
            }
        });
    }

    @Override
    public void useridCheck(PAUseridCheckData data, PAResultHandler<PAUseridCheckResponseData> paResultHandler) {
        payAppWebRequestManager.connection(PAOAPIConstValue.CMD_USER_ID_CHECK, data, new PAResultHandler<PAResponseData>() {
            @Override
            public void response(PAResponseData result) {
                PAUseridCheckResponseData responseData = null;
                try {
                    responseData = new ObjectMapper().readValue(result.getReturnJsonData(), PAUseridCheckResponseData.class);
                } catch (IOException e) {
                    e.printStackTrace();
                }
                paResultHandler.response(responseData);
            }
        });
    }

    @Override
    public void subidRegist(PASubidRegistData data, PAResultHandler<PASubidRegistResponseData> paResultHandler) {
        payAppWebRequestManager.connection(PAOAPIConstValue.CMD_SUB_ID_REGIST, data, new PAResultHandler<PAResponseData>() {
            @Override
            public void response(PAResponseData result) {
                PASubidRegistResponseData responseData = null;
                try {
                    responseData = new ObjectMapper().readValue(result.getReturnJsonData(), PASubidRegistResponseData.class);
                } catch (IOException e) {
                    e.printStackTrace();
                }
                paResultHandler.response(responseData);
            }
        });
    }

    @Override
    public void cashStRegist(PACashStRegistData data, PAResultHandler<PACashStResponseData> paResultHandler) {
        payAppWebRequestManager.connection(PAOAPIConstValue.CMD_CASH_ST_REGIST, data, new PAResultHandler<PAResponseData>() {
            @Override
            public void response(PAResponseData result) {
                PACashStResponseData responseData = null;
                try {
                    responseData = new ObjectMapper().readValue(result.getReturnJsonData(), PACashStResponseData.class);
                } catch (IOException e) {
                    e.printStackTrace();
                }
                paResultHandler.response(responseData);
            }
        });
    }

    @Override
    public void cashStCancel(PACashStCancelData data, PAResultHandler<PACashStCnResponseData> paResultHandler) {
        payAppWebRequestManager.connection(PAOAPIConstValue.CMD_CASH_ST_CANCEL, data, new PAResultHandler<PAResponseData>() {
            @Override
            public void response(PAResponseData result) {
                PACashStCnResponseData responseData = null;
                try {
                    responseData = new ObjectMapper().readValue(result.getReturnJsonData(), PACashStCnResponseData.class);
                } catch (IOException e) {
                    e.printStackTrace();
                }
                paResultHandler.response(responseData);
            }
        });
    }

    @Override
    public void checkNpayCashReceiptReq(PACheckNpayCashReceiptReqData data, PAResultHandler<PACheckNpayCashReceiptReqResponseData> paResultHandler) {
        payAppWebRequestManager.connection(PAOAPIConstValue.CMD_CHECK_NPAY_CASH_RECEIPT_REQ, data, new PAResultHandler<PAResponseData>() {
            @Override
            public void response(PAResponseData result) {
                PACheckNpayCashReceiptReqResponseData responseData = null;
                try {
                    responseData = new ObjectMapper().readValue(result.getReturnJsonData(), PACheckNpayCashReceiptReqResponseData.class);
                } catch (IOException e) {
                    e.printStackTrace();
                }

                paResultHandler.response(responseData);
            }
        });
    }

    @Override
    public void billRegister(PABillRegisterData data, PAResultHandler<PABillRegisterResponseData> paResultHandler) {
        payAppWebRequestManager.connection(PAOAPIConstValue.CMD_BILL_REGISTER, data, new PAResultHandler<PAResponseData>() {
            @Override
            public void response(PAResponseData result) {
                PABillRegisterResponseData responseData = null;
                try {
                    responseData = new ObjectMapper().readValue(result.getReturnJsonData(), PABillRegisterResponseData.class);
                } catch (IOException e) {
                    e.printStackTrace();
                }
                paResultHandler.response(responseData);
            }
        });
    }

    @Override
    public void billDelete(PABillDeleteData data, PAResultHandler<PABillDeleteResponseData> paResultHandler) {
        payAppWebRequestManager.connection(PAOAPIConstValue.CMD_BILL_DELETE, data, new PAResultHandler<PAResponseData>() {
            @Override
            public void response(PAResponseData result) {
                PABillDeleteResponseData responseData = null;
                try {
                    responseData = new ObjectMapper().readValue(result.getReturnJsonData(), PABillDeleteResponseData.class);
                } catch (IOException e) {
                    e.printStackTrace();
                }
                paResultHandler.response(responseData);
            }
        });
    }

    @Override
    public void billPayment(PABillPaymentData data, PAResultHandler<PABillPaymentResponseData> paResultHandler) {
        payAppWebRequestManager.connection(PAOAPIConstValue.CMD_BILL_PAYMENT, data, new PAResultHandler<PAResponseData>() {
            @Override
            public void response(PAResponseData result) {
                PABillPaymentResponseData responseData = null;
                try {
                    responseData = new ObjectMapper().readValue(result.getReturnJsonData(), PABillPaymentResponseData.class);
                } catch (IOException e) {
                    e.printStackTrace();
                }
                paResultHandler.response(responseData);
            }
        });
    }
}
