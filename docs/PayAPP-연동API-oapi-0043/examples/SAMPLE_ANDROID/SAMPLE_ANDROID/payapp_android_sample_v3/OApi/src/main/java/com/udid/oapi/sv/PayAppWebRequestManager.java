package com.udid.oapi.sv;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.udid.oapi.PAOAPIConstValue;
import com.udid.oapi.data.PAResponseData;
import com.udid.oapi.lib.PAStrLib;
import com.udid.oapi.sv.handler.PAResultHandler;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.io.OutputStreamWriter;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashMap;
import java.util.Map;

import io.reactivex.rxjava3.android.schedulers.AndroidSchedulers;
import io.reactivex.rxjava3.core.Observable;
import io.reactivex.rxjava3.disposables.Disposable;
import io.reactivex.rxjava3.functions.Consumer;
import io.reactivex.rxjava3.schedulers.Schedulers;


/**
 * Create by 김진원
 */
public class PayAppWebRequestManager {

    private Disposable backgroundTask;

    void connection(String cmd, Object object, PAResultHandler<PAResponseData> paResultHandler) {

        Map<String, String> cryptParam = new ObjectMapper().convertValue(object, Map.class);
        cryptParam.put("cmd", cmd);

        HashMap<String, String> map = new HashMap<>();

        backgroundTask = Observable.fromCallable(() -> {

            try {

                URL url = new URL(PAOAPIConstValue.BASE_URL);

                HttpURLConnection httpURLConnection = (HttpURLConnection) url.openConnection();
                httpURLConnection.setRequestMethod("POST");
                httpURLConnection.setDoInput(true);
                httpURLConnection.setDoOutput(true);
                httpURLConnection.setConnectTimeout(30 * 1000);
                httpURLConnection.setReadTimeout(30 * 1000);
                httpURLConnection.connect();

                OutputStream outputStream = httpURLConnection.getOutputStream();
                BufferedWriter bufferedWriter = new BufferedWriter(new OutputStreamWriter(outputStream, "UTF-8")); //캐릭터셋 설정

                String param = PAStrLib.convertEncodeQueryString(cryptParam);
                bufferedWriter.write(param);
                bufferedWriter.flush();
                bufferedWriter.close();
                outputStream.flush();
                outputStream.close();

                // 요청 성공
                if (200 <= httpURLConnection.getResponseCode() && httpURLConnection.getResponseCode() <= 299) {       // 성공

                    BufferedReader br = new BufferedReader(new InputStreamReader((httpURLConnection.getInputStream())));
                    StringBuilder result = new StringBuilder();
                    String line = null;

                    while ((line = br.readLine()) != null) {
                        if (result.length() > 0) {
                            result.append("\n");
                        }
                        result.append(line);
                    }

                    String jsonString = PAStrLib.queryStringToJsonString(result.toString());
                    map.put("data", jsonString);
                    httpURLConnection.disconnect();

                }
                // 요청 실패
                else {

                    String jsonString = PAStrLib.queryStringToJsonString("state=0&errorMessage=" + httpURLConnection.getResponseCode() + " 에러");
                    map.put("data", jsonString);
                }

            } catch (Exception e){

                String jsonString = PAStrLib.queryStringToJsonString("state=0&errorMessage=데이터 호출에 실패하였습니다.");
                map.put("data", jsonString);
            }

            return map;

        }).subscribeOn(Schedulers.io()).observeOn(AndroidSchedulers.mainThread()).subscribe(new Consumer<HashMap<String, String>>() {
            @Override
            public void accept(HashMap<String, String> map) {

                String data = map.get("data");

                PAResponseData paResponseData = null;
                try {
                    paResponseData = new ObjectMapper().readValue(data, PAResponseData.class);
                } catch (IOException e) {
                    e.printStackTrace();
                }

                paResponseData.setReturnJsonData(data);
                paResultHandler.response(paResponseData);

                backgroundTask.dispose();
            }
        });

    }


}
