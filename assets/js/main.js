AOS.init();

new Typed("#typed", {
    strings: [
        "PARAS TECHNOLOGY LIMITED",
        "The future is NOW!",
        "Advancing the medical world.",
    ],
    typeSpeed: 70,
    delaySpeed: 400,
    loop: true,
});

$("#btn-nav").click(function () {
    $(".nav-menu").toggleClass("active");
});
$("#btn-menu").click(function () {
    $(".nav-menu").removeClass("active");
});
$("#nav-link").click(function () {
    $(".nav-menu").removeClass("active");
});
$("#nav-link1").click(function () {
    $(".nav-menu").removeClass("active");
});
$("#nav-link2").click(function () {
    $(".nav-menu").removeClass("active");
});
$("#nav-link3").click(function () {
    $(".nav-menu").removeClass("active");
});
$("#nav-link4").click(function () {
    $(".nav-menu").removeClass("active");
});
$("#nav-link5").click(function () {
    $(".nav-menu").removeClass("active");
});

$(".carousel").flickity({
    cellAlign: "left",
    contain: true,
    autoPlay: true,
    wrapAround: true,
    pageDots: false,
});
$(".main-carousel").flickity({
    cellAlign: "left",
    contain: true,
    autoPlay: 5000,
    wrapAround: true,
    prevNextButtons: false,
    pageDots: false,
    draggable: false,
});
var scroll = new SmoothScroll('a[href*="#"]', {
    speed: 300,
    speedAsDuration: true
});
var easeInQuint = new SmoothScroll('[data-easing="easeInQuint"]', { easing: 'easeInQuint' });
