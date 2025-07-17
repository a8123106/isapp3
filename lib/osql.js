
var osql = {};

//osql.baseurl = '';
osql.baseurl = 'https://dbkiso.si.aoyama.ac.jp';
osql.db = 'a8123106';//適宜自分のDB名に変えてください
osql.via = null;

/** ************************ */
osql.version = '2.2.0';

/***
 * osql.js 
 * 　oursql　APIにアクセスするためのjsライブラリ
 * 
 * version2.0.0　2023.06.17 
 * ・今までのosql.jsを統合
 * ・バージョン追加
 * ・ファイルアップロード機能に対応
 * version2.0.1　2023.06.17 
 * ・autoobjectに対応
 * version2.0.2&3　2023.06.17 
 * ・ファイルアップロード機能修正
 * ・getHistoryのコードをクリーンに
 * version2.0.4　2023.09.08 
 * ・クロスドメイン時，token=でトークンを渡された時に，URLパラメータを全部切りとってしまっていた問題の解決
 * version2.1.0 2024.09.12
 * ・connectImplネットワークエラーを取得できるように変更
 * version2.1.5 2024.09.17
 * ・invalid tokenエラーの際に，logoutする処理の追加
 * version2.2.0 2024.09.19
 * ・escapeSingleQuoteの追加
 * ・getUserAgentの追加
 * 
 ***/

osql.url = osql.baseurl + '/oursql2/api/index.php';
osql.meurl = osql.baseurl + '/oursql2/api/me.php';
osql.uploadurl = osql.baseurl + '/oursql2/api/fileupload.php';
osql.historyurl = osql.baseurl + '/oursql2/api/history.php';

osql.requireLogin = function () {
    var token;
    token = osql.getParams()['token'];
    if (token) {
        localStorage.setItem('access-token', token);
        var url = document.URL;
        var goto = url.split("?token=")[0];
        goto = goto.split("&token=")[0];
        window.location = goto;
    }

    token = osql.getCookies()['access-token'];
    if (!token) {
        token = localStorage.getItem('access-token');
    }

    if (!token) {
        osql.login();
    }
};

osql.login = function (userid, password, success, failure) {
    osql.goto(osql.baseurl + '/oursql2/oauth/login.php?referer=' + encodeURIComponent(document.URL));
};

osql.logout = function () {
    localStorage.removeItem('access-token');
    osql.goto(osql.baseurl + '/oursql2/oauth/logout.php?referer=' + encodeURIComponent(document.URL));
};

osql.goto = function (url) {
    if (!url) {
        return;
    }
    window.localStorage.setItem('referrer', location.href);
    window.location.href = url;
};

osql.back = function (defaulturl) {
    var ref = window.localStorage.getItem('referrer');
    if (ref) {
        window.location.href = ref;
    } else if (defaulturl) {
        window.location.href = defaulturl;
    } else {
        //do nothing
    }
};

osql.connect = async function (sql, autoobject = true) {
    if (Array.isArray(sql)) {
        var sqls = [];
        sql.forEach(function (each) {
            sqls.push(each.replace(/\\/g, '\\\\'));
        });
        sql = JSON.stringify(sqls);
    } else {
        sql = sql.replace(/\\/g, '\\\\');
    }
    var query = {};
    query.db = osql.db;
    query.sql = sql;
    query.via = osql.via;
    var res = await osql.connectImpl(query);
    if (autoobject && res.objects) {
        return res.objects;
    }
    return res;
}

osql.connectInsert = async function (sql) {
    var sqls = [];
    sqls.push(sql);
    sqls.push('select LAST_INSERT_ID() as lastId;');
    var obj = await osql.connect(sqls);
    return obj[0].lastId;
}

osql.getMe = async function () {
    var query = {};
    var res = await osql.connectImpl(query, osql.meurl);
    if (res.user) {
        var user = res.user;
        var studentid = user.id.split('@')[0];
        studentid = '1' + studentid.substring(1, 8);
        user.studentid = studentid;
        return res.user;
    } else {
        return null;
    }
}

osql.getHistory = async function () {
    var query = {};
    var res = await osql.connectImpl(query, osql.historyurl);
    if (res.histories) {
        return res.histories;
    } else {
        return null;
    }
}

osql.connectImpl = function (query, url) {
    var token = localStorage.getItem('access-token');
    if (token) {
        query['access-token'] = token;
    }
    if (!url) {
        url = osql.url;
    }
    return new Promise(function (resolve) {
        $.post(url, query)
            .done(function (data, textStatus, jqXHR) {
                try {
                    var res = JSON.parse(data);
                    if (res.status != 200) {
                        if (res.status === 401) {//no token
                            osql.requireLogin();
                            //die;
                        }
                        if (res.status === 402) {//invalid token
                            osql.logout();
                            //die();
                        }
                        console.error('Error in osql.connect() \n sql:' + query.sql + '\n data: ' + data);
                    }
                    resolve(res);
                } catch (ex) {
                    console.error('Error in osql.connect() \n sql:' + query.sql + '\n data: ' + data);
                    console.error(ex);
                    resolve({});
                }
            })
            .fail(function (jqXHR, textStatus, errorThrown) {
                console.error('Error in osql.connect() \n sql:' + query.sql);
                console.error(textStatus);
                resolve({ status: 500 });
            });
    });
}

osql.uploadFile = function (object, appname, progress) {
    if (!appname) {
        appname = osql.db;
    }
    if (!progress) {
        progress = function (t) { console.log(t) };
    }
    var url = `${osql.uploadurl}?appname=${appname}`;
    var token = localStorage.getItem('access-token');
    if (token) {
        url = url + `&access-token=${token}`;
    }
    var query = {
        xhr: function () {
            var xhr = new window.XMLHttpRequest();
            xhr.upload.addEventListener("progress", progress, false);
            return xhr;
        },
        url: url,
        type: 'POST',
        data: object,
        processData: false, // dataをクエリ文字列に変換しない
        contentType: false, // リクエストのContent-Typeを指定しない
    }
    return new Promise(function (resolve) {
        $.ajax(query).done(function (data) {
            var obj = JSON.parse(data);
            resolve(obj);
        }).fail(function (jqXHR, textStatus, errorThrown) {
            resolve(false);
        })
    });
}

osql.getParams = function () {
    var paramstr = document.location.search.substring(1);
    paramstr = decodeURI(paramstr);
    var paramstrs = paramstr.split('&');
    params = {};
    paramstrs.forEach(function (each) {
        var tokens = each.split('=');
        params[tokens[0]] = tokens[1];
    });
    return params;
};

osql.getParam = function (key) {
    return osql.getParams()[key];
};

osql.getCookies = function () {
    var cookies = {};
    var cookiesArray = document.cookie.split(';');

    //２つ目以降，cookieの前にスペースが入る実行系がある
    for (var c of cookiesArray) {
        while (c.charAt(0) == ' ') {
            c = c.substring(1, c.length);
        }
        var cookie = c.split('=');
        cookies[cookie[0]] = cookie[1];
    }
    return cookies;
}

osql.escapeSingleQuote = function (str) {
    return str.replaceAll(/'/g, "''");
}

osql.getUserAgent = function () {
    userAgent = navigator.userAgent;
    // OSの判定
    const osArray = [
        { name: 'Android', regex: /Android/ },
        { name: 'iOS', regex: /iPhone|iPad|iPod/ },
        { name: 'Windows', regex: /Windows NT/ },
        { name: 'Mac OS', regex: /Macintosh/ },
        { name: 'Linux', regex: /Linux/ },
    ];

    let os = 'Unknown OS';
    for (let i = 0; i < osArray.length; i++) {
        if (osArray[i].regex.test(userAgent)) {
            os = osArray[i].name;
            break;
        }
    }

    // ブラウザの判定
    const browserArray = [
        { name: 'Edge', regex: /Edg/ },
        { name: 'Chrome', regex: /Chrome|CriOS/ },
        { name: 'Firefox', regex: /Firefox/ },
        { name: 'Safari', regex: /Safari/ },
        { name: 'Opera', regex: /OPR|Opera/ },
        { name: 'Internet Explorer', regex: /MSIE|Trident/ },
    ];

    let browser = 'Unknown Browser';
    for (let i = 0; i < browserArray.length; i++) {
        if (browserArray[i].regex.test(userAgent)) {
            browser = browserArray[i].name;
            break;
        }
    }

    return {
        os: os,
        browser: browser,
        isPC: function () {
            return os === 'Windows' || os === 'Mac OS' || os === 'Linux';
        },
        isMobile: function () {
            return os === 'Android' || os === 'iOS';
        }
    };
}
// Mac Chrome
//{"os":"Mac OS","browser":"Chrome"}Mozilla / 5.0(Macintosh; Intel Mac OS X 10_15_7) AppleWebKit / 537.36(KHTML, like Gecko) Chrome / 128.0.0.0 Safari / 537.36

// iPhone
// { "os": "iOS", "browser": "Safari" } Mozilla / 5.0(iPhone; CPU iPhone OS 17_6_1 like Mac OS X) AppleWebKit / 605.1.15(KHTML, like Gecko) Version / 17.6 Mobile / 15E148 Safari / 604.1

// Android 
// { "os": "Android", "browser": "Chrome" } Mozilla/5.0 (Linux; Android 10; SAMSUNG SM-G965F) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/10.1 Chrome/71.0.3578.99 Mobile Safari/537.36           

// Mac safari
//{"os":"Mac OS","browser":"Safari"}Mozilla / 5.0(Macintosh; Intel Mac OS X 10_15_7) AppleWebKit / 605.1.15(KHTML, like Gecko) Version / 17.4.1 Safari / 605.1.15

// 学校のPC, chrome
// { "os": "Windows", "browser": "Chrome" }
// Mozilla / 5.0(Windows NT 10.0; Win64; x64) AppleWebKit / 537.36(KHTML, like Gecko) Chrome / 128.0.0.0 Safari / 537.36
//  
// 学校のPC　firebox
// { "os": "Windows", "browser": "Firefox" } Mozilla / 5.0(Windows NT 10.0; Win64; x64; rv: 130.0) Gecko / 20100101 Firefox / 130.0
//  
// 学校のPC　edge
// { "os": "Windows", "browser": "Edge" } Mozilla / 5.0(Windows NT 10.0; Win64; x64) AppleWebKit / 537.36(KHTML, like Gecko) Chrome / 128.0.0.0 Safari / 537.36 Edg / 128.0.0.0