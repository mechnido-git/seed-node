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

const emailSchedule = (date, eventId, userId, eventName, name, due, duDate, destinationEmail, paidDate) => {
    //sent email reminder before 6 hourse, 1 day, 2 day, 3day of the due date
    const hours = [6, 24, 48, 72]
    hours.forEach(h => {
        const d = getDate(date, h) //get exact date and time to schedule email
        console.log(d);
        cron.schedule(`${0} ${d.hour} ${d.day} ${d.month} *`, async () => {
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
        console.log(`${0} ${d.hour} ${d.day} ${d.month} *`);
    })
    let lastDate = getDate(date, hours[hours.length - 1])

    let newDate = {
        hour:0,
        month: paidDate.month,
        day: paidDate.day,
        year: paidDate.year
    }
    let current = getPlusDate(newDate, 168)
    console.log(current.month < lastDate.month);
    for (let i = 0; (current.month <= lastDate.month && current.day <= lastDate.day && current.year <= lastDate.year); current = getPlusDate(current, 168)){
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
    let d = {...date};
    for (let i = 0; i < hours; i++) {
        if (d.hour === 0) {
            if (d.day === 1) {
                if (d.month === 1) {
                    d.year = d.year - 1
                    d.month = 12
                    d.day = 30
                    d.hour = 23
                    continue
                }
                d.month = d.month - 1
                d.day = 30
                d.hour = 23
                continue
            }
            d.day = d.day - 1
            d.hour = 23
            continue
        }
        d.hour = d.hour - 1
    }
    return d
}

const getPlusDate = (date, hours) => {
    let d = {...date}
    for (let i = 0; i < hours; i++) {
        if (d.hour === 23) {
            if (d.day === 30) {
                if (d.month === 12) {
                    d.year = d.year + 1
                    d.month = 1
                    d.day = 1
                    d.hour = 0
                    continue
                }
                d.month = d.month + 1
                d.day = 1
                d.hour = 0
                continue
            }
            d.day = d.day + 1
            d.hour = 0
            continue
        }
        d.hour = d.hour + 1
    }
    return d
}

module.exports = { emailSchedule }