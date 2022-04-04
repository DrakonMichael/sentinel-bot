const puppeteer = require('puppeteer');
const fs = require('fs');
let Jimp = require('jimp');
let widejoyData = require("./imgdata.json");
let accounts = require("./accounts.json");
const { createCanvas, Image } = require("canvas");
// Require the necessary discord.js classes
const { Client, Intents, MessageEmbed, MessageAttachment } = require('discord.js');

// Create a new client instance
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });


let ad = {};
let totalPixels = 0;
let totalIncorrect = 0;
let imageBufferData = [];

let TOP_LEFT = {x: 110, y: 805}
let WIDTH = 120
let HEIGHT = 25


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
                "blue": [54, 144, 234],
                "NOCOLOR": [69, 69, 69]
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

            let c = {rgb: color, name: name};
            arr[x][y] = c;
        }
    }

    widejoyData = arr;
    fs.writeFileSync('imgdata.json', JSON.stringify(arr));

});


const getColorIndicesForCoord = (x, y, width) => {
    const red = y * (width * 4) + x * 4;
    return [red, red + 1, red + 2, red + 3];
};


let username = Object.keys(accounts)[0];
let password = accounts[username];
createAccount(username, password);


 async function createAccount(username, password) {
    ad[username] = {status: "INIT", username: username, password: password, eta: "N/A", action: "Initializing"};
    const browser = await puppeteer.launch({
        headless: true
    });
    const page = await browser.newPage();
    await page.setDefaultNavigationTimeout(0);
    ad[username].action = "Navigating to login";
    await page.goto('https://www.reddit.com/login/');
    ad[username].action = "Logging in";
    await page.type('#loginUsername', username)
    await page.type("#loginPassword", password)
    await page.click("body > div > main > div.OnboardingStep.Onboarding__step.mode-auth > div > div.Step__content > form > fieldset:nth-child(8) > button");
    await page.waitForNavigation({'waitUntil':'domcontentloaded'});
    ad[username].action = "Redirecting to r/place";

    getErrors(page);
    setInterval(() => {getErrors(page);}, 60000)
}


async function getErrors(page) {
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

        let errors = []
        totalIncorrect = 0;
        totalPixels = 0;
        for (let x = 0; x < WIDTH; x++) {
            for (let y = 0; y < HEIGHT; y++) {
                const colorIndices = getColorIndicesForCoord(x, y, WIDTH);
                const [redIndex, greenIndex, blueIndex, alphaIndex] = colorIndices;
                const [r, g, b, a] = [canvasData[redIndex], canvasData[greenIndex], canvasData[blueIndex], canvasData[alphaIndex]];
                const prgb = widejoyData[x][y].rgb;

                if (widejoyData[x][y] !== "NOCOLOR") {
                    totalPixels++;
                    if (r !== prgb.r || g !== prgb.g || b !== prgb.b) {
                        errors.push({coords: {x: x + TOP_LEFT.x, y: y + TOP_LEFT.y}, color: widejoyData[x][y].name})
                        totalIncorrect++;
                    }
                }

            }
        }
        console.log("got data (" + totalIncorrect + " incorrect)");
    } catch (err) {
        console.log(err);
        return;
    }
}


async function getCanvasData(canvasPage) {
    return canvasPage.$eval("pierce/canvas", (cv) => {
        let TOP_LEFT = {x: 110, y: 805}
        let WIDTH = 120
        let HEIGHT = 25
        return Object.values(cv.getContext("2d").getImageData(TOP_LEFT.x, TOP_LEFT.y, WIDTH, HEIGHT).data);
    });
}


function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


// When the client is ready, run this code (only once)
client.once('ready', async () => {
    console.log('Ready! Preparing to send in 20 seconds...');

    await sleep(20 * 1000);
    
    let ACCURACY_UPDATES_CHANNEL = '960042266905444382';
    client.channels.fetch(ACCURACY_UPDATES_CHANNEL)
        .then(channel => {
            sendMessage(channel);
            setInterval(() => {
                sendMessage(channel);
            }, 1000*(5*60))
        })
        .catch(console.error);
});


async function sendMessage(channel) {

    let imageBuffer = Buffer.from(imageBufferData);
    const imageAttachment = new MessageAttachment(imageBuffer, "killjoy-status-" + Date.now());

    // First generate the embed to be sent
    // depending on if any data has been fetched yet or not
    let embed = null;
    if (totalPixels === 0) {
        embed = new MessageEmbed()
            .setColor('#ff6666')
            .setTitle('Waiting for pixel data...')
    }
    else {
        let percentage = ((totalPixels-totalIncorrect)/totalPixels)*100;


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
    }

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
