const soloWinnerMessages = [
    "🎉 BINGO! You are the one and only champion this round!",
    "🏆 You won! Everyone else was just a spectator in your Bingo greatness!",
    "🔥 First place! You snatched the Bingo crown before anyone else!",
    "🎊 The Bingo gods have chosen you as their champion!",
    "🚀 You completed Bingo before anyone else could blink! Speedrun world record?",
    "👑 BINGO! You stand alone at the top. Bow down, peasants!",
    "⚡ Lightning-fast Bingo win! The others didn't even see it coming!",
    "🎭 *And the award for Best Bingo Player goes to... YOU!* 🏆",
    "💰 If Bingo had prize money, you'd be buying a yacht right now!",
    "🐉 A true Bingo warrior! You slayed the game and took the throne!",
    "🥇 You got Bingo first! Everyone else? Just background characters in your story!",
    "🎤 BINGO! Someone get this person a trophy and a standing ovation!",
    "🕶 You didn't just win… you made everyone else wish they had your numbers!",
    "🏹 Bullseye! You hit Bingo like a true sharpshooter!",
    "🤯 UNREAL! Your Bingo card must have been **blessed by the universe!**",
    "🎯 You just speedran Bingo! World record attempt submitted.",
    "🔮 I see a vision… and it's you as the **Ultimate Bingo Champion!**",
    "😎 You just left your opponents in the dust. Enjoy your victory lap!",
    "🚨 BREAKING NEWS: You single-handedly conquered Bingo! Everyone else? Try again!",
    "💥 You came, you saw, you BINGO'd! And the crowd goes wild! 🎉"
];


const multiWinnerMessages = [
    "🎉 BINGO! We have multiple champions! What a close game!",
    "🏆 It's a Bingo tie! Several players hit BINGO at the same time!",
    "🔥 Whoa! A Bingo showdown! You and others won together!",
    "🎊 It's a Bingo party! We have multiple winners!",
    "🚀 This was a photo finish! Several players won in a Bingo **speed race!**",
    "⚡ DOUBLE TROUBLE! Or triple… or more! A Bingo **MEGA WIN**!",
    "👑 A Bingo **royal family** has formed! You all share the crown!",
    "🎤 And the crowd goes wild! A synchronized BINGO victory!",
    "💰 Too close to call! Multiple winners just cashed in at the same time!",
    "🐉 It's a Bingo **clash of titans**! No single winner… just legends!",
    "🥇 Everyone who won deserves a **Bingo Hall of Fame** spot!",
    "🤯 A MULTI-BINGO? This round will be remembered in history!",
    "🎯 Several players hit the mark at the same time! What a match!",
    "🔮 Fate decided there would be **not one, but MANY** winners!",
    "😎 It's a Bingo **Battle Royale**, and you ALL survived to the end!",
    "🚨 MASSIVE WIN ALERT! Multiple people **outplayed the rest!**",
    "💥 It's raining Bingos! So many players called it at the same time!",
    "👀 This round was WILD! Too close to pick just one winner!",
    "🔥 The most intense Bingo match ever! A multi-player finish!",
    "🥵 This Bingo round was so fast, even the game can't keep up!"
];


const loserMessages = [
    "😢 BING-NO! Someone else got there first!",
    "💔 So close, yet so far! Someone else snatched Bingo first!",
    "🎲 Better luck next time! Maybe your numbers just needed a hug.",
    "😭 Your Bingo dreams just got shattered like glass.",
    "🤡 You played well… just not well *enough.*",
    "🕶 You didn't lose… you just let someone else have a turn. *Right?*",
    "📉 Bingo stock just crashed because of that loss.",
    "🔮 The fortune teller predicted a win… she LIED.",
    "😵 That wasn't luck… that was a *curse!*",
    "🐌 You were too slow! Someone else grabbed Bingo before you!",
    "🧐 Your numbers were... let's just say *not ideal.*",
    "👀 I think your Bingo card was just a piece of paper. Try again?",
    "🎻 The world's smallest violin is playing just for you right now. 🎻",
    "🌪️ Bingo storm hit... and you got swept away. RIP.",
    "⚰️ Your Bingo dreams just got *buried six feet under.*",
    "👎 You had **one job**… and fate said 'NOPE!'",
    "🫠 If ‘almost winning' was a sport, you'd be an Olympic gold medalist!",
    "🚨 BREAKING NEWS: You *almost* won Bingo. The world remains unchanged.",
    "🧙‍♂️ Maybe if you had a magic spell, you'd have won. But nope!",
    "📜 You just made it into the Bingo Hall of... *Almosts*."
];

export const getGameOverMessage = (winCount = 0, isWin = false) => {
    if (winCount === 0) {
        return null;
    }
    if (!isWin) {
        return loserMessages[Math.floor(Math.random() * loserMessages.length)];
    } else {
        if (winCount === 1) {
            return soloWinnerMessages[Math.floor(Math.random() * soloWinnerMessages.length)];
        } else {
            return multiWinnerMessages[Math.floor(Math.random() * multiWinnerMessages.length)];
        }
    }
}
