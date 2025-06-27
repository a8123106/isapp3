
var osql = {};

//osql.baseurl = '';
osql.baseurl = 'https://dbkiso.si.aoyama.ac.jp';
osql.db = 'a8123106';//適宜自分のDB名に変えてください
osql.via = null;

/** ************************ */

osql.version = '2.0.3';

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
        var goto = url.split('?')[0];
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
        $.post(url, query, function (data) {
            try {
                var res = JSON.parse(data);
                if (res.status != 200) {
                    if (res.status === 401) {//no token
                        osql.requireLogin();
                        //die;
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

