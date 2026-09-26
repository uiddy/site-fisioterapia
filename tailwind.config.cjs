module.exports = {
    content: ['./public/index.html', './public/site.js'],
    theme: {
        extend: {
            colors: {
                'brand-purple': '#7A0099',
                'brand-teal': '#00A396',
                'brand-purple-light': '#9e2dbd',
                'brand-teal-light': '#14c9ba',
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
                heading: ['Montserrat', 'sans-serif'],
                cursive: ['Caveat', 'cursive'],
            },
        },
    },
};
