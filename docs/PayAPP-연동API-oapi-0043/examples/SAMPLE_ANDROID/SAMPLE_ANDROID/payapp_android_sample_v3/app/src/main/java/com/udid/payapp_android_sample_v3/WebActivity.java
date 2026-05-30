package com.udid.payapp_android_sample_v3;


import android.os.Bundle;

import androidx.appcompat.app.AppCompatActivity;

import com.udid.oapi.view.PAWebView;


/**
 * Create by 김진원
 */
public class WebActivity extends AppCompatActivity {

    /**
     * PAWebView 샘플입니다.
     * 앱제작사의 용도에 맞게 WebView를 새로 만들어 커스텀하세요.
     */
    PAWebView paWebView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_web);

        String url = getIntent().getStringExtra("url");
        paWebView = findViewById(R.id.paWebView);
        paWebView.init(this);
        paWebView.setPAWebViewClient();
        paWebView.loadUrl(url);
        paWebView.addJavascriptInterface(new JavaScriptMethods(), "제작사 InterfaceName");



    }

    /**
     * Returnurl 이동 후 제작사 상황에 맞게 커스텀 하세요.
     */
    class JavaScriptMethods {
        JavaScriptMethods() {
        }

        @android.webkit.JavascriptInterface
        public void finish() {
        }
    }
}
