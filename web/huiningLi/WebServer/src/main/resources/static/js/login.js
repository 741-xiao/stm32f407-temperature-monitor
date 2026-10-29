$(function () {
    $(document).keyup(function (event) {
        if (event.keyCode === 13) {
            $("#login").click();
        }
    });

    layui.use(['form', 'jquery'], function () {
        var $ = layui.jquery,
            layer = layui.layer,
            form = layui.form;

        form.render();

        form.on('submit(login)', function (obj) {
            // console.log(obj.field);
            if ($("#username").val() === '') {
                layer.msg("请输入用户名！", {
                    icon: 5, anim: 6, shade: [0.5, '#000000'], shadeClose: true
                });

                return false;
            } else if ($("#password").val() === '') {
                layer.msg("请输入密码！", {
                    icon: 5, anim: 6, shade: [0.5, '#000000'], shadeClose: true
                });

                return false;
            } else {
                $.ajax({
                    type: "post",
                    datatype: 'json',
                    url: "/toLogin",
                    data: obj.field,
                    success: function (res) {
                        if (res === "1") {
                            location.href = "/index";
                        } else if (res === "2") {
                            layer.msg('用户名或密码错误', {
                                icon: 5, shade: [0.5, '#000000'], shadeClose: true
                            });
                            return false;
                        } else if (res === "3") {
                            layer.msg('用户不存在或已停用', {
                                icon: 5, shade: [0.5, '#000000'], shadeClose: true
                            });
                            return false;
                        }
                    }
                });
            }

        })
    });

});
