package kr.co.udid.payapp.sample;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;

/**
 * Created by kimjinwon on 2016. 11. 10..
 */
@Controller
public class ViewController {

    @RequestMapping(value = "/")
    public String index ()
    {
        return "index";
    }


    // 결제요청
    @RequestMapping(value = "/paymentReq")
    public String paymentReq ()
    {
        return "paymentReq";
    }


    // 결제취소
    @RequestMapping(value = "/paymentReqCancel")
    public String paymentReqCancel ()
    {
        return "paymentReqCancel";
    }


    // 결제 취소 요청
    @RequestMapping(value = "/paymentCancelReq")
    public String paymentCancelReq ()
    {
        return "paymentCancelReq";
    }

    // 정기 결제 요청
    @RequestMapping(value = "/paymentRegularReq")
    public String paymentRegularReq ()
    {
        return "paymentRegularReq";
    }

    // 정기 결제 취소
    @RequestMapping(value = "/paymentCancelRegularReq")
    public String paymentCancelRegularReq ()
    {
        return "paymentCancelRegularReq";
    }


    // 부계정 등록
    @RequestMapping(value = "/subidRegist")
    public String subidRegist ()
    {
        return "subidRegist";
    }


    // 현금영수증 발행
    @RequestMapping(value = "/cashSt")
    public String cashSt ()
    {
        return "cashSt";
    }

    // 현금영수증 발행 취소
    @RequestMapping(value = "/cashStCn")
    public String PayappCashStCn ()
    {
        return "cashStCn";
    }




}
