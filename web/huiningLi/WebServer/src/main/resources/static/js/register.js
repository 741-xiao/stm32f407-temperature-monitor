$(function () {
    $(document).keyup(function (event) {
        if (event.keyCode === 13) {
            $("#login").click();
        }
    });

    layui.use(['form', 'jquery', 'layer'], function () {
        var $ = layui.jquery,
            layer = layui.layer,
            form = layui.form;

        form.render();

        form.on('submit(register)', function (obj) {

            if (/^(?![a-zA-z]+$)(?!\d+$)(?![!@#$%^&*+.]+$)[a-zA-Z\d!@#$%^&*+.]+$/.exec($("#password").val()) === null) {
                layer.msg("密码格式错误", {
                    icon: 2, shade: [0.5, '#000000'], shadeClose: true
                });
                return false;
            } else if ($('#password').val() !== $('#pwdConfirm').val()) {
                layer.msg("两次输入密码不一致", {
                    icon: 5, shade: [0.5, '#000000'], shadeClose: true
                });
                return false;
            } else {
                $.ajax({
                    type: 'post',
                    url: '/register',
                    data: obj.field,
                    success: function (res) {
                        if (res === "success") {
                            layer.open({
                                type: 1,
                                title: '注册成功',
                                area: ['240px', '150px'],
                                shade: 0.5,
                                icon: 1,
                                btnAlign: 'c',
                                offset: [
                                    ($(window).height() - 240) / 2
                                    , ($(window).width() - 200) / 2
                                ],
                                content: $('#register-success'),
                                btn: ['确定', '关闭'],
                                yes: function () {
                                    layer.close();
                                    window.location = '/login';
                                },
                                btn2: function () {
                                    layer.close();
                                }
                            });
                        } else if (res === "fail") {
                            layer.msg('用户名已存在',{
                                icon: 5, shade: [0.5, '#000000'], shadeClose: true
                            })
                        } else if (res === "error") {
                            layer.open({
                                type: 1,
                                title: '注册失败',
                                area: ['240px', '180px'],
                                shade: 0.5,
                                icon: 1,
                                btnAlign: 'c',
                                offset: [
                                    ($(window).height() - 240) / 2
                                    , ($(window).width() - 200) / 2
                                ],
                                content: $('#register-error'),
                                btn: ['确认'],
                                yes: function () {
                                    layer.closeAll();
                                }
                            });
                        }
                    }
                })
            }
        })
    })
});