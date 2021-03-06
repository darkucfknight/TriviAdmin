let CURRENT_USER_ID = null;
let db = null;
let masterCatRef = null;
let catRef = null;
let questionRef = null;

document.addEventListener('DOMContentLoaded', (event) => {
    const app = firebase.app();

    db = firebase.firestore();
    masterCatRef = db.collection('master_categories');
    catRef = db.collection('categories');
    questionRef = db.collection('questions');

    // const query = masterCatRef.qhere('owner_id', '==', );
    // query.get().then((questions) => {
    //     questions.forEach((doc) => {
    //         data = doc.data();
    //         document.write(
    //             `question: ${data.question} <br> answer: ${data.answer} <br>`
    //         );
    //     });
    // });
});

function googleLogin() {
    const provider = new firebase.auth.GoogleAuthProvider();
    const db = firebase.firestore();
    firebase
        .auth()
        .signInWithPopup(provider)
        .then((result) => {
            const user = result.user;
            CURRENT_USER_ID = user.uid;
            const userRef = db.collection('users');
            userRef.doc(user.uid).set({
                display_name: user.displayName,
                email: user.email,
                photo_URL: user.photoURL,
                last_login: new Date(),
            });
            document.getElementById('login-button').innerHTML =
                user.displayName;
        })
        .catch(console.log);
}

function updateQuestion(e) {
    const db = firebase.firestore();
    const myQuestion = db.collection('questions').doc('IAI77NovNZ1iEpXgghtQ');
    myQuestion.update({ question: e.target.value });
}

function uploadFile(files) {
    const storageRef = firebase.storage().ref();
    const horseRef = storageRef.child('horse.jpg');

    const file = files.item(0);

    const task = horseRef.put(file);

    task.snapshot.ref.getDownloadURL().then(function (downloadURL) {
        console.log('File available at', downloadURL);
        const url = downloadURL;
        document.querySelector('#imgUpload').setAttribute('src', url);
    });
}

function readTextFile(file, callback) {
    var rawFile = new XMLHttpRequest();
    rawFile.overrideMimeType('application/json');
    rawFile.open('GET', file, true);
    rawFile.onreadystatechange = function () {
        if (rawFile.readyState === 4 && rawFile.status == '200') {
            callback(rawFile.responseText);
        }
    };
    rawFile.send(null);
}
