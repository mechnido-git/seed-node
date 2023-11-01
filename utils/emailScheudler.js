const cron = require('node-cron')

const { initializeApp } = require("firebase/app");
const { firebaseConfig } = require("../config");
const {
    doc,
    getFirestore,
    getDoc,
} = require("firebase/firestore");
const { getDueEmail } = require('../emails/dueEmail');
const { sendGmail } = require('./send-email');

initializeApp(firebaseConfig);

const db = getFirestore();

const emailSchedule = (date, eventId, userId, eventName, name, due, duDate, destinationEmail) => {
    //sent email reminder before 6 hourse, 1 day, 2 day, 3day of the due date
    const hours = [6, 24, 48, 72]
    hours.forEach(h => {
        const d = getDate(date, h) //get exact date and time to schedule email
        cron.schedule(`${41} ${d.hour} ${d.day} ${d.month} *`, async () => {
            try {
                let yes = await shouldSend(eventId, userId)
                console.log(yes);
                if (yes) {
                    const email = getDueEmail(name, due, duDate, eventName)
                    await sendGmail(
                        destinationEmail,
                        `${email}`,
                        `Reminder: Payment Due for ${eventName} - Seed - A Unit of Mechnido`,
                    );
                }
                console.log('email sent');
            } catch (error) {
                console.log(error);
            }
        });
        console.log("remainder scheduled before " + h + " hours");
        console.log(`${41} ${d.hour} ${d.day} ${d.month} *`);
    })
    let lastDate = getDate(date, hours[hours.length - 1])
    const date = new Date();

    let day = date.getDate();
    let month = date.getMonth() + 1;
    let year = date.getFullYear();
    let newDate = {
        hour:0,
        month: month,
        day: day,
        year: year
    }
    let current = getPlusDate(newDate, 168)
    for (let i = 0; (current.month < lastDate.month && current.day <= lastDate.day && current.year <= lastDate.year); current = getPlusDate(current, 168)){
        cron.schedule(`${0} ${current.hour} ${current.day} ${current.month} *`, async () => {
            try {
                let yes = await shouldSend(eventId, userId)
                console.log(yes);
                if (yes) {
                    const email = getDueEmail(name, due, duDate, eventName)
                    await sendGmail(
                        destinationEmail,
                        `${email}`,
                        `Reminder: Payment Due for ${eventName} - Seed - A Unit of Mechnido`,
                    );
                }
                console.log('email sent');
            } catch (error) {
                console.log(error);
            }
        });
        console.log("scheduled");
        console.log(`${0} ${current.hour} ${current.day} ${current.month} *`);
    }

}

const shouldSend = async (eventId, userId) => {
    const eventRef = doc(db, "events", eventId);
    try {
        const docsnap = await getDoc(eventRef)
        if (docsnap.exists) {
            index = null
            docsnap.data().enrolled.forEach((n, i) => {
                if (n.userId == userId) index = i
            })
            const phase = docsnap.data().enrolled[index].phase
            if (phase != 2) return true
        } else {
            console.log('not exist');
            return false
        }
    } catch (error) {
        console.log(error);
    }
}

const getDate = (date, hours) => {
    for (let i = 0; i < hours; i++) {
        if (date.hour === 0) {
            if (date.day === 1) {
                if (date.month === 1) {
                    date.year = date.year - 1
                    date.month = 12
                    date.day = 30
                    date.hour = 23
                }
                date.month = date.month - 1
                date.day = 30
                date.hour = 23
                continue
            }
            date.day = date.day - 1
            date.hour = 23
            continue
        }
        date.hour = date.hour - 1
    }
    return date
}

const getPlusDate = (date, hours) => {
    for (let i = 0; i < hours; i++) {
        if (date.hour === 23) {
            if (date.day === 30) {
                if (date.month === 12) {
                    date.year = date.year + 1
                    date.month = 1
                    date.day = 1
                    date.hour = 0
                }
                date.month = date.month + 1
                date.day = 1
                date.hour = 0
                continue
            }
            date.day = date.day + 1
            date.hour = 0
            continue
        }
        date.hour = date.hour - 1
    }
    return date
}

module.exports = { emailSchedule }