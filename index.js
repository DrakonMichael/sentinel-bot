const puppeteer = require('puppeteer');
const fs = require('fs');
let Jimp = require('jimp');
let widejoyData = require("./imgdata.json");
let accounts = require("./accounts.json");
// Require the necessary discord.js classes
const { Client, Intents, MessageEmbed } = require('discord.js');

// Create a new client instance
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });




let ad = {};
let totalPixels = 0;
let totalIncorrect = 0;

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
            let name = "";

            if(r === 0 && g === 0 && b === 0) { name = "black" };
            if(r === 81 && g === 233 && b === 244) { name = "light blue" };
            if(r === 255 && g === 255 && b === 255) { name = "white" };
            if(r === 137 && g === 141 && b === 144) { name = "gray" };
            if(r === 156 && g === 105 && b === 38) { name = "brown" };
            if(r === 255 && g === 153 && b === 170) { name = "light pink" };
            if(r === 180 && g === 74 && b === 192) { name = "purple" };
            if(r === 129 && g === 30 && b === 159) { name = "dark purple" };
            if(r === 212 && g === 215 && b === 217) { name = "light gray" };
            if(r === 255 && g === 214 && b === 53) { name = "yellow" };
            if(r === 36 && g === 80 && b === 164) { name = "dark blue" };
            if(r === 255 && g === 69 && b === 0) { name = "red" };
            if(r === 255 && g === 168 && b === 0) { name = "orange" };
            if(r === 126 && g === 237 && b === 86) { name = "light green" };
            if(r === 0 && g === 163 && b === 104) { name = "dark green" };
            if(r === 54 && g === 144 && b === 234) { name = "blue" };
            if(r === 69 && g === 69 && b === 69) { name = "NOCOLOR" };

            if(name === "") {
                console.log("ERROR! Tile " + x + "," + y + " MISSING COLOR");
                process.exit(1);
            }

            let c = {rgb: color, name: name};


            arr[x][y] = c;
        }
    }
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
        setInterval(() => {getErrors(page);}, 30000)

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
         console.log("got pixel data");
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

// When the client is ready, run this code (only once)
client.once('ready', () => {
    console.log('Ready!');
});


const getDataEmbed = () => {

    if(totalPixels === 0) {
           return new MessageEmbed()
               .setColor('#ff6666')
               .setTitle('Waiting for pixel data...')
    }

    let adjustmentFactor = 25;
    let percentage = ((totalPixels-totalIncorrect)/totalPixels)*100;
    let percentageAdjusted = ((totalPixels-totalIncorrect + adjustmentFactor)/totalPixels)*100;

    const embed = new MessageEmbed()
        .setColor('#ff6666')
        .setTitle('Widejoy Progress Update')
        .setDescription('NARROW THEIR OPTIONS // WIDEN OUR JOY')
        .addFields(
            { name: 'Correct Tiles', value: (totalPixels-totalIncorrect).toString(), inline: true },
            { name: 'Incorrect Tiles', value: (totalIncorrect).toString(), inline: true },
            { name: 'Progress', value: `${totalPixels-totalIncorrect}/${totalPixels}`, inline: true },
            //{ name: 'Adjusted Progress', value: `${totalPixels-totalIncorrect + adjustmentFactor}/${totalPixels}`, inline: true },
            { name: 'Accuracy', value: percentage.toFixed(3).toString() + "%", inline: true }
            //{ name: 'Adjusted Accuracy', value: percentageAdjusted.toFixed(3).toString() + "%", inline: true }
        )
        .setTimestamp()
        .setFooter({ text: 'Created by DrakonMichael for r/VALORANT' });

    return embed;
}

client.on("messageCreate", (msg) => {
    if(msg.author.id == 188031012444307457) {
        if(msg.content === ".link") {
            console.log("link");
            msg.reply("Linked to this channel")
            msg.channel.send({ embeds: [getDataEmbed()] });
            setInterval(() => {
                msg.channel.send({ embeds: [getDataEmbed()] });
            }, 1000*(5*60))
        }
    }
})

let config = require("./config.json");
// Login to Discord with your client's token
client.login(config.token);