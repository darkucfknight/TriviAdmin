let CURRENT_USER_ID = null;
let CURRENT_QUESTION_ID = null;
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
        clearQuestion();
        loadCategories(event.target.id);
        masterCatRef
            .doc(event.target.id)
            .get()
            .then((masterCat) => {
                showPointValues(masterCat.data().point_values);
            });
    }

    // Used Toggle
    if (event.target.matches('#used-toggle-slider')) {
        clearQuestion();
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
        clearQuestion();
        document.getElementById('category-select-button').innerHTML =
            event.target.innerHTML;
        document
            .getElementById('category-select-button')
            .setAttribute('data-cat-id', event.target.id);
        getPointCounts(
            event.target.id,
            document.getElementById('used-toggle').checked
        );
        loadQuestion(null);
    }

    // Point Val Select
    if (event.target.matches('.point-list-item')) {
        clearQuestion();
        document
            .getElementById('quick-question-count-bar')
            .getElementsByClassName('active')[0]
            ?.classList.remove('active');
        document
            .getElementById('point-count-' + event.target.id)
            ?.classList.add('active');
        loadQuestion(event.target.id);
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
            inputClone.value = doc.id;
            inputLabelClone.id = doc.id;
            inputLabelClone.innerHTML = doc.data().name;
            inputLabelClone.setAttribute('for', 'radio_' + doc.id);

            inputClone.style.display = 'block';
            inputLabelClone.style.display = 'block';
            masterCatList.appendChild(inputClone);
            masterCatList.appendChild(inputLabelClone);

            if (first) {
                inputClone.setAttribute('checked', true);
                showPointValues(doc.data().point_values);
                loadCategories(doc.id);
                first = false;
            }
        });
    });
}

function showPointValues(pointValues) {
    pointValues.sort();
    const pointList = document.getElementById('point-select');
    pointList.innerHTML = '';
    const pointButtonTemplate = document.getElementById(
        'point-button-template'
    );
    const pointButtonTemplateLabel = document.getElementById(
        'point-button-template-label'
    );

    pointValues.forEach(function (pointVal) {
        let btnClone = pointButtonTemplate.cloneNode(true);
        let btnLabelClone = pointButtonTemplateLabel.cloneNode(true);
        btnClone.id = 'radio_' + pointVal;
        btnClone.value = pointVal;
        btnLabelClone.id = pointVal;
        btnLabelClone.innerHTML = pointVal;
        btnLabelClone.setAttribute('for', 'radio_' + pointVal);

        btnClone.style.display = 'block';
        btnLabelClone.style.display = 'block';
        pointList.appendChild(btnClone);
        pointList.appendChild(btnLabelClone);
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
        let pointsTupleCount = {};
        questions.forEach((qDoc) => {
            if (pointsTupleCount[qDoc.data().points] == undefined) {
                pointsTupleCount[qDoc.data().points] = 1;
            } else {
                pointsTupleCount[qDoc.data().points] += 1;
            }
        });

        const qCountList = document.getElementById('quick-question-count-bar');
        qCountList.innerHTML = '';
        let pointFilterVal = document.querySelector(
            'input[name="point-val"]:checked'
        )?.value;

        Object.entries(pointsTupleCount).forEach(([pointVal, qCount]) => {
            let thisQCount = document.createElement('div');
            thisQCount.classList.add('q-count');
            thisQCount.id = 'point-count-' + pointVal;
            thisQCount.innerHTML = qCount;

            if (pointVal == '2' && qCount < 15) {
                thisQCount.classList.add('insufficient');
            }
            if (qCount < 5) {
                thisQCount.classList.add('insufficient');
            }

            if (pointFilterVal && pointFilterVal == pointVal) {
                thisQCount.classList.add('active');
            }
            qCountList.appendChild(thisQCount);
        });
        sortByID(qCountList);
    });
}

function loadQuestion(pointVal = null) {
    let masterCatID = document.querySelector('input[name="master-cat"]:checked')
        ?.value;
    let catID = document
        .getElementById('category-select-button')
        .getAttribute('data-cat-id');
    let used = document.getElementById('used-toggle').checked;
    if (!pointVal) {
        pointVal = document.querySelector('input[name="point-val"]:checked')
            ?.value;
    }

    if (masterCatID && catID != 'false' && pointVal) {
        const randKey = questionRef.doc().id;

        let questionQuery = questionRef
            .where('master_category_id', '==', masterCatRef.doc(masterCatID))
            .where('category_id', '==', catRef.doc(catID))
            .where('points', '==', parseFloat(pointVal))
            .where('used', '==', used)
            .where(
                firebase.firestore.FieldPath.documentId(),
                '!=',
                CURRENT_QUESTION_ID ? CURRENT_QUESTION_ID : randKey
            );

        // Randomize selection be generating a random key and getting the document with the key that matches most closely
        questionQuery
            .where(firebase.firestore.FieldPath.documentId(), '>=', randKey)
            .limit(1)
            .get()
            .then((snapshot) => {
                if (snapshot.size > 0) {
                    snapshot.forEach((doc) => {
                        CURRENT_QUESTION_ID = doc.id;
                        showQuestion(doc.data());
                    });
                } else {
                    questionQuery
                        .where(
                            firebase.firestore.FieldPath.documentId(),
                            '<',
                            randKey
                        )
                        .limit(1)
                        .get()
                        .then((snapshot) => {
                            if (snapshot.size == 0) {
                                if (CURRENT_QUESTION_ID) {
                                    CURRENT_QUESTION_ID = null;
                                    showSnackbar(
                                        'Only one question matched your selection.'
                                    );
                                    loadQuestion();
                                } else {
                                    showSnackbar(
                                        'Zero questions matched your selection.'
                                    );
                                }
                            }
                            snapshot.forEach((doc) => {
                                CURRENT_QUESTION_ID = doc.id;
                                showQuestion(doc.data());
                            });
                        })
                        .catch((err) => {
                            console.log('Error getting documents', err);
                        });
                }
            });
    }
}

function showQuestion(question) {
    document.getElementById('question-text').innerHTML = question?.question;
    document.getElementById('multi-choice-text').innerHTML =
        question?.multiple_choice;
    document.getElementById('answer-text').innerHTML = question?.answer;
    document.getElementById('source-text').innerHTML = question?.source;
    document.getElementById('explanation-text').innerHTML =
        question?.explanation;
    document.getElementById('question-loader').style.display = 'none';
}

function clearQuestion() {
    document.getElementById('question-text').innerHTML = '';
    document.getElementById('multi-choice-text').innerHTML = '';
    document.getElementById('answer-text').innerHTML = '';
    document.getElementById('source-text').innerHTML = '';
    document.getElementById('explanation-text').innerHTML = '';
}

function sortByID(unsortedList) {
    let createdqCountListItems = unsortedList.childNodes;
    let unsortedItems = [];
    for (var i in createdqCountListItems) {
        if (createdqCountListItems[i].nodeType == 1) {
            // get rid of the whitespace text nodes
            unsortedItems.push(createdqCountListItems[i]);
        }
    }
    unsortedItems.sort(function (a, b) {
        return a.id == b.id ? 0 : a.id > b.id ? 1 : -1;
    });
    for (i = 0; i < unsortedItems.length; ++i) {
        unsortedList.appendChild(unsortedItems[i]);
    }
}

function showSnackbar(text) {
    // Get the snackbar DIV
    const snack = document.getElementById('snackbar');
    snack.innerHTML = text;

    // Add the "show" class to DIV
    snack.className = 'show';

    // After 3 seconds, remove the show class from DIV
    setTimeout(function () {
        snack.className = snack.className.replace('show', '');
    }, 3000);
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
