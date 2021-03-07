let CURRENT_USER_ID = null;
let GOOGLE_TOKEN = null;
let db = null;
let masterCatRef = null;
let catRef = null;
let questionRef = null;

const SIGN_OUT_MODAL = new bootstrap.Modal(
    document.getElementById('sign-out-confirm-modal')
);

// || On First Load
document.addEventListener('DOMContentLoaded', (event) => {
    const app = firebase.app();

    db = firebase.firestore();
    masterCatRef = db.collection('master_categories');
    catRef = db.collection('categories');
    questionRef = db.collection('questions');

    loadMasterCats();
});

// || ALL Click Events (single listener for optimization)
// TODO Handle spam clicking
document.addEventListener('click', function (event) {
    // Profile Icon
    if (
        event.target.matches('#sign-in-button') ||
        event.target.matches('#profile-icon')
    ) {
        handleProfileClick();
    }

    // Sign out modal confirm
    if (event.target.matches('#confirm-sign-out')) {
        googleLogout();
        SIGN_OUT_MODAL.hide();
    }

    // MasterCat Select
    if (event.target.matches('.master-cat-list-item')) {
        loadCategories(event.target.id);
    }

    // Used Toggle
    if (event.target.matches('#used-toggle-slider')) {
        let currentCatID = document
            .getElementById('category-select-button')
            .getAttribute('data-cat-id');
        if (currentCatID !== 'false') {
            // Get opposite of current used val as animation hasn't completed yet
            getPointCounts(
                currentCatID,
                !document.getElementById('used-toggle').checked
            );
        }
    }

    // Category Select
    if (event.target.matches('.category-list-item')) {
        document.getElementById('category-select-button').innerHTML =
            event.target.innerHTML;
        document
            .getElementById('category-select-button')
            .setAttribute('data-cat-id', event.target.id);
        getPointCounts(
            event.target.id,
            document.getElementById('used-toggle').checked
        );
    }
});

function handleProfileClick() {
    if (GOOGLE_TOKEN === null) {
        googleLogin();
    } else {
        SIGN_OUT_MODAL.show();
    }
}

function googleLogin() {
    const provider = new firebase.auth.GoogleAuthProvider();
    const db = firebase.firestore();
    firebase
        .auth()
        .signInWithPopup(provider)
        .then((result) => {
            const user = result.user;
            CURRENT_USER_ID = user.uid;
            GOOGLE_TOKEN = result.credential.accessToken;
            const userRef = db.collection('users');

            userRef.doc(user.uid).set({
                display_name: user.displayName,
                email: user.email,
                photo_URL: user.photoURL,
                last_login: new Date(),
            });

            document.getElementById('profile-icon').style.display = 'none';
            document.getElementById('sign-in-button').style.backgroundImage =
                'url(' + user.photoURL + ')';
        })
        .catch(console.log);
}

function googleLogout() {
    firebase
        .auth()
        .signOut()
        .then(
            function () {
                console.log('Signout Succesfull');
                GOOGLE_TOKEN = null;
                document.getElementById('profile-icon').style.display = 'flex';
                document.getElementById(
                    'sign-in-button'
                ).style.backgroundImage = 'none';
            },
            function (error) {
                console.log('Signout Failed');
            }
        );
}

function updateQuestion(e) {
    const db = firebase.firestore();
    const myQuestion = db.collection('questions').doc('IAI77NovNZ1iEpXgghtQ');
    myQuestion.update({ question: e.target.value });
}

// Load master categories
// TODO add user id param for per-user loading
function loadMasterCats() {
    const masterCatList = document.getElementById('master-cat-select');
    masterCatList.innerHTML = '';

    masterCatRef.get().then((masterCats) => {
        let first = true;
        masterCats.forEach((doc) => {
            // Clone template button and append
            const inputTemplate = document.querySelector(
                '#master-cat-button-template'
            );
            const inputTemplateLabel = document.querySelector(
                '#master-cat-button-template-label'
            );

            let inputClone = inputTemplate.cloneNode(true);
            let inputLabelClone = inputTemplateLabel.cloneNode(true);
            inputClone.id = 'radio_' + doc.id;
            inputLabelClone.id = doc.id;
            inputLabelClone.innerHTML = doc.data().name;
            inputLabelClone.setAttribute('for', 'radio_' + doc.id);

            inputClone.style.display = 'block';
            inputLabelClone.style.display = 'block';
            masterCatList.appendChild(inputClone);
            masterCatList.appendChild(inputLabelClone);

            if (first) {
                inputClone.setAttribute('checked', true);
                loadCategories(doc.id);
                first = false;
            }
        });
    });
}

function loadCategories(masterCatID) {
    const catList = document.getElementById('category-list');
    catList.innerHTML = '';
    document.getElementById('category-select-button').innerHTML =
        'Select Category';
    document
        .getElementById('category-select-button')
        .setAttribute('data-cat-id', false);
    document.getElementById('quick-question-count-bar').innerHTML = '';

    let catQuery = catRef.where(
        'master_category_id',
        '==',
        masterCatRef.doc(masterCatID)
    );
    catQuery.get().then((categories) => {
        categories.forEach((cat) => {
            const catListItemTemplate = document.querySelector(
                '#category-list-item-template'
            );
            let clone = catListItemTemplate.cloneNode(true);
            clone.id = cat.id;
            clone.innerHTML = cat.data().name;
            clone.style.display = 'block';
            catList.appendChild(clone);
        });
    });
}

function getPointCounts(catID, used) {
    let countQuery = questionRef
        .where('category_id', '==', catRef.doc(catID))
        .where('used', '==', used);
    countQuery.get().then((questions) => {
        console.log('total questions: ' + questions.size);
        let pointsTupleCount = {};
        questions.forEach((qDoc) => {
            if (pointsTupleCount[qDoc.data().points] == undefined) {
                pointsTupleCount[qDoc.data().points] = 1;
            } else {
                pointsTupleCount[qDoc.data().points] += 1;
            }
        });
        console.log(pointsTupleCount);

        const qCountList = document.getElementById('quick-question-count-bar');
        qCountList.innerHTML = '';
        Object.entries(pointsTupleCount).forEach(([pointVal, qCount]) => {
            let thisQCount = document.createElement('div');
            thisQCount.innerHTML = qCount;

            if (pointVal == '2' && qCount < 15) {
                thisQCount.classList.add('insufficient');
            }
            if (qCount < 5) {
                thisQCount.classList.add('insufficient');
            }
            qCountList.appendChild(thisQCount);
        });
    });
}

// function uploadFile(files) {
//     const storageRef = firebase.storage().ref();
//     const horseRef = storageRef.child('horse.jpg');

//     const file = files.item(0);

//     const task = horseRef.put(file);

//     task.snapshot.ref.getDownloadURL().then(function (downloadURL) {
//         console.log('File available at', downloadURL);
//         const url = downloadURL;
//         document.querySelector('#imgUpload').setAttribute('src', url);
//     });
// }
