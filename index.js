const puppeteer = require('puppeteer');
const fs = require('fs');
let Jimp = require('jimp');
let accounts = require("./accounts.json");
const { createCanvas, Image, Canvas } = require("canvas");
// Require the necessary discord.js classes
const { Client, Intents, MessageEmbed, MessageAttachment } = require('discord.js');

// Create a new client instance
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });


let ad = {};
let imageBufferData = [];

const TOP_LEFT = {x: 110, y: 805};
const WIDTH = 120;
const HEIGHT = 25;

const MESSAGE_INTERVAL = 5;
const ACCURACY_UPDATES_CHANNEL = '960042266905444382';

// Gets filled with the page object when reddit loads and can be used to interact with the r/place canvas
let page;

// Gets filled with the data from the widejoy template
let widejoyData;


Jimp.read('./input.png', (err, img) => {
    if (err) throw err;

    let arr = [];
    for(let x = 0; x < WIDTH; x++) {
        for(let y = 0; y < HEIGHT; y++) {
            let color = Jimp.intToRGBA(img.getPixelColor(x, y));
            if(!arr[x]) {
                arr[x] = [];
            }

            let {r, g, b, a} = color;

            let colours = {
                "black": [0, 0, 0],
                "light blue": [81, 233, 244],
                "white": [255, 255, 255],
                "gray": [137, 141, 144],
                "brown": [156, 105, 38],
                "light pink": [255, 153, 170],
                "purple": [180, 74, 192],
                "dark purple": [129, 30, 159],
                "light gray": [212, 215, 217],
                "yellow": [255, 214, 53],
                "dark blue": [36, 80, 164],
                "red": [255, 69, 0],
                "orange": [255, 168, 0],
                "light green": [126, 237, 86],
                "dark green": [0, 163, 104],
                "blue": [54, 144, 234]
            }

            // Find the closest pixel
            let name = "black";
            let closestDistance = 99999999;
            for (const [colName, col] of Object.entries(colours)) {
                let dist = Math.sqrt( (r - col[0])**2 + (g - col[1])**2 + (b - col[2])**2);
                if (dist < closestDistance) {
                    name = colName;
                    closestDistance = dist;
                }
            }

            // Update to the exact colour
            color[0] = colours[name][0];
            color[1] = colours[name][1];
            color[2] = colours[name][2];

            arr[x][y] = {rgb: color, name: name};
        }
    }

    widejoyData = arr;
    // fs.writeFileSync('imgdata.json', JSON.stringify(arr));

});


const getColorIndicesForCoord = (x, y, width) => {
    const red = y * (width * 4) + x * 4;
    return [red, red + 1, red + 2, red + 3];
};


async function createAccount() {
    let username = Object.keys(accounts)[0];
    let password = accounts[username];

    ad[username] = {status: "INIT", username: username, password: password, eta: "N/A", action: "Initializing"};
    const browser = await puppeteer.launch({
        headless: true
    });
    page = await browser.newPage();
    await page.setDefaultNavigationTimeout(0);
    ad[username].action = "Navigating to login";
    await page.goto('https://www.reddit.com/login/');
    ad[username].action = "Logging in";
    await page.type('#loginUsername', username)
    await page.type("#loginPassword", password)
    await page.click("body > div > main > div.OnboardingStep.Onboarding__step.mode-auth > div > div.Step__content > form > fieldset:nth-child(8) > button");
    await page.waitForNavigation({'waitUntil':'domcontentloaded'});
    ad[username].action = "Redirecting to r/place";
}


async function getErrors() {
    try {
        await page.goto('https://www.reddit.com/r/place/?cx=' + 0 + '&cy=' + 0 + '&px=17');
        const iframe = await page.$("#SHORTCUT_FOCUSABLE_DIV > div:nth-child(4) > div > div > div > div._3ozFtOe6WpJEMUtxDOIvtU > div._2lTcCESjnP_DKJcPBqBFLK > iframe");
        const canvasPage = await iframe.contentFrame();
        await page.click("#SHORTCUT_FOCUSABLE_DIV > div:nth-child(4) > div > div > div > div._3ozFtOe6WpJEMUtxDOIvtU > div._2lTcCESjnP_DKJcPBqBFLK > iframe");

        let canvasData = await getCanvasData(canvasPage);
        let emptyCanvas = true;

        while (emptyCanvas) {
            canvasData = await getCanvasData(canvasPage);

            let sum = 0;
            for (let i = 0; i < canvasData.length; i++) {
                sum += canvasData[i];
            }

            if (sum === 0) {
                await (page.waitForTimeout(1000));
            } else {
                emptyCanvas = false;
            }
        }

        imageBufferData = [...canvasData];

        let errors = [];
        let totalIncorrect = 0;
        let totalPixels = 0;
        for (let x = 0; x < WIDTH; x++) {
            for (let y = 0; y < HEIGHT; y++) {
                const colorIndices = getColorIndicesForCoord(x, y, WIDTH);
                const [redIndex, greenIndex, blueIndex, alphaIndex] = colorIndices;
                const [r, g, b, a] = [canvasData[redIndex], canvasData[greenIndex], canvasData[blueIndex], canvasData[alphaIndex]];
                const prgb = widejoyData[x][y].rgb;

                totalPixels++;
                if (r !== prgb.r || g !== prgb.g || b !== prgb.b) {
                    errors.push({coords: {x: x + TOP_LEFT.x, y: y + TOP_LEFT.y}, color: widejoyData[x][y].name})
                    totalIncorrect++;
                }
            }
        }
        return {totalPixels, totalIncorrect};

    } catch (err) {
        console.log(err);
        return;
    }
}


async function getCanvasData(canvasPage) {
    return canvasPage.$eval("pierce/canvas", (cv) => {
        // WHY WHY WHY DOES THIS NEED TO BE HERE ASEOUVMA;SEIURT;AOPIUNBO
        let TOP_LEFT = {x: 110, y: 805};
        let WIDTH = 120;
        let HEIGHT = 25;
        return Object.values(cv.getContext("2d").getImageData(TOP_LEFT.x, TOP_LEFT.y, WIDTH, HEIGHT).data);
    });
}


// When the client is ready, run this code (only once)
client.once('ready', async () => {
    console.log('(1/2) Logged into Discord');

    // Now log into Reddit
    await createAccount();
    console.log('(2/2) Logged into Reddit');

    client.channels.fetch(ACCURACY_UPDATES_CHANNEL)
        .then(channel => {
            sendMessage(channel);
            setInterval(() => {
                sendMessage(channel);
            }, 1000 * (MESSAGE_INTERVAL * 60));
        })
        .catch(console.error);
});


async function sendMessage(channel) {

    // From the reddit canvas, calculate the percentage of correct pixels
    let {totalPixels, totalIncorrect} = await getErrors();
    let percentage = ((totalPixels-totalIncorrect)/totalPixels)*100;

    // Here we create a canvas and scale up the widejoy, and also put a pixel inside wrong ones
    // showing the right colour for that tile
    let scale = 3;
    let canvas = new Canvas(WIDTH * scale, HEIGHT * scale);
    const context = canvas.getContext("2d");
    let im = context.createImageData(1, 1);
    for (let x = 0; x < WIDTH * scale; x++) {
        for (let y = 0; y < HEIGHT * scale; y++) {
            const colorIndices = getColorIndicesForCoord(Math.floor(x/scale), Math.floor(y/scale), WIDTH);
            const [ri, gi, bi, ai] = colorIndices;
            im.data[0] = imageBufferData[ri];
            im.data[1] = imageBufferData[gi];
            im.data[2] = imageBufferData[bi];
            im.data[3] = 255;
            context.putImageData(im, x, y);
        }
    }
    for (let x = 0; x < WIDTH; x++) {
        for (let y = 0; y < HEIGHT; y++) {
            const prgb = widejoyData[x][y].rgb;
            im.data[0] = prgb.r;
            im.data[1] = prgb.g;
            im.data[2] = prgb.b;
            im.data[3] = 255
            context.putImageData(im, scale * x + 1, scale * y + 1);
        }
    }

    const imageAttachment = new MessageAttachment(canvas.toBuffer(), "killjoy-status-" + Date.now() + '.jpg');

    embed = new MessageEmbed()
        .setColor('#ff6666')
        .setTitle('Widejoy Progress Update')
        .setDescription('**NARROW THEIR OPTIONS // WIDEN OUR JOY** <:perfectwidejoy:960300099060265071>')
        .addFields(
            { name: 'Correct Tiles', value: (totalPixels-totalIncorrect).toString(), inline: true },
            { name: 'Incorrect Tiles', value: (totalIncorrect).toString(), inline: true },
            { name: 'Progress', value: `${totalPixels-totalIncorrect}/${totalPixels}`, inline: true },
            //{ name: 'Adjusted Progress', value: `${totalPixels-totalIncorrect + adjustmentFactor}/${totalPixels}`, inline: true },
            { name: 'Accuracy', value: percentage.toFixed(3).toString() + "%", inline: true }
            //{ name: 'Adjusted Accuracy', value: percentageAdjusted.toFixed(3).toString() + "%", inline: true }
        )
        .setImage(`attachment://${imageAttachment.name}`)
        .setTimestamp()
        .setFooter({ text: 'Created by DrakonMichael & Histefanhere for r/VALORANT' });

    // Send the messeage to the provided channel!
    console.log("Sending message... (Incorrect tiles: " + (totalIncorrect).toString() + ")");
    channel.send({
        embeds: [embed],
        files: [imageAttachment]
    });
}


let config = require("./config.json");
// Login to Discord with your client's token
client.login(config.token);
