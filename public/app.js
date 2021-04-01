let CURRENT_USER_ID = null;
let CURRENT_QUESTION_ID = null;
let CURRENT_MODE = 'host';
let ERROR_COUNT = 0;
let db = null;
let masterCatRef = null;
let catRef = null;
let questionRef = null;
let userRef = null;
let pointCountChart = null;
let editingQuestionData = null;

const SIGN_OUT_MODAL = new bootstrap.Modal(
    document.getElementById('sign-out-confirm-modal')
);

const INPUT_MODAL = new bootstrap.Modal(document.getElementById('input-modal'));

let QUESTION_TABLE = new DataTable('#questions-table', {
    perPage: 3,
    perPageSelect: false,
    layout: {
        top: '',
        bottom: '{search}{pager}',
    },
    plugins: {
        editable: {
            enabled: true,
            contextMenu: false,
        },
    },
});
QUESTION_TABLE.columns().hide([0]);
QUESTION_TABLE.on('editable.save.cell', function (newValue, oldValue, cell) {
    editingQuestionData[editingQuestionData.indexOf(oldValue)] = newValue;
    updateQuestion(editingQuestionData);
});
document
    .querySelector('#questions-table')
    .addEventListener('dblclick', function (e) {
        let rowNum = e.target.parentNode.rowIndex - 1;
        if (rowNum > -1) {
            editingQuestionData = [].slice
                .call(QUESTION_TABLE.data[rowNum].cells)
                .map(function (cell) {
                    return cell.textContent;
                });
        }
    });

// || On First Load
document.addEventListener('DOMContentLoaded', (event) => {
    const app = firebase.app();

    // Check logged-in status
    firebase.auth().onAuthStateChanged(function (user) {
        if (user) {
            getLoggedInUserData(user);
        } else {
            CURRENT_USER_ID = null;
            handleLogout();
            loadMasterCats();
        }
    });

    db = firebase.firestore();
    masterCatRef = db.collection('master_categories');
    catRef = db.collection('categories');
    questionRef = db.collection('questions');
    userRef = db.collection('users');
});

// || ALL CLICK EVENTS (single listener for optimization)
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

    if (event.target.matches('.mode-select:not(.active)')) {
        document
            .querySelector('.mode-select.active')
            .classList.remove('active');
        event.target.classList.add('active');
        switchMode(event.target.getAttribute('data-mode'));
    }

    // MasterCat Select
    if (event.target.matches('.master-cat-list-item')) {
        clearQuestion();
        ERROR_COUNT = 0;

        document
            .querySelectorAll('.master-cat-list-item.active')[0]
            ?.classList?.remove('active');

        event.target.classList.add('active');

        document.getElementById('mark-used-button-mobile').style.display =
            'flex';
        document.getElementById('mark-used-button').style.display = 'flex';

        let masterCatSelectButton = document.getElementById(
            'mastercat-select-button'
        );
        masterCatSelectButton.classList.remove('active');
        masterCatSelectButton.innerHTML = 'Public';
        masterCatSelectButton.setAttribute('data-mastercat-id', '');

        loadCategories(event.target.id);

        loadCountGraph(event.target.id);

        masterCatRef
            .doc(event.target.id)
            .get()
            .then((masterCat) => {
                showPointValues(masterCat.data().point_values);
            });
    }

    if (event.target.matches('.mastercat-list-item')) {
        ERROR_COUNT = 0;
        clearQuestion();

        document
            .querySelectorAll('.master-cat-list-item.active')[0]
            ?.classList?.remove('active');

        document.getElementById('mark-used-button').style.display = 'none';
        document.getElementById('mark-used-button-mobile').style.display =
            'none';

        let mastercatSelectButton = document.getElementById(
            'mastercat-select-button'
        );
        mastercatSelectButton.innerHTML = event.target.innerHTML;
        mastercatSelectButton.setAttribute(
            'data-mastercat-id',
            event.target.id
        );
        mastercatSelectButton.classList.add('active');

        if (document.querySelector('input[name="master-cat"]:checked')) {
            document.querySelector(
                'input[name="master-cat"]:checked'
            ).checked = false;
        }

        loadCategories(event.target.id);
        loadCountGraph(event.target.id);

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
        ERROR_COUNT = 0;

        // Value not accurate due to animation. Take opposite of current val to get new val.
        const newUsedVal = !document.getElementById('used-toggle').checked;

        let currentCatID = document
            .getElementById('category-select-button')
            .getAttribute('data-cat-id');

        document.getElementById('mark-used-button').innerHTML = newUsedVal
            ? 'Mark Unused'
            : 'Mark Used';
        document.getElementById(
            'mark-used-button-mobile'
        ).innerHTML = newUsedVal ? 'Mark Unused' : 'Mark Used';

        if (currentCatID !== 'false') {
            // Get opposite of current used val as animation hasn't completed yet
            getPointCounts(currentCatID, newUsedVal);
        }
        window.setTimeout(function () {
            loadCountGraph();
        }, 500);

        if (CURRENT_MODE == 'plan') {
            populateQuestionTable();
        }
    }

    // Category Select
    if (event.target.matches('.category-list-item')) {
        clearQuestion();
        ERROR_COUNT = 0;

        document.getElementById('category-select-button').innerHTML =
            event.target.innerHTML;
        document
            .getElementById('category-select-button')
            .setAttribute('data-cat-id', event.target.id);
        getPointCounts(
            event.target.id,
            document.getElementById('used-toggle').checked
        );

        if (CURRENT_MODE == 'host') {
            loadQuestion(null);
        } else {
            populateQuestionTable();
        }
    }

    // Point Val Select
    if (event.target.matches('.point-list-item')) {
        clearQuestion();
        ERROR_COUNT = 0;

        // FUCK BOOTSTRAP RADIO BUTTON GROUPS
        // APPARENTLY ATTRIBUTE:CHECKED IS NOT THE SAME AS .CHECKED
        document.querySelector(
            "#point-select input[id='radio_" + event.target.id + "']"
        ).checked = true;

        document
            .querySelectorAll('.q-count.active')[0]
            ?.classList.remove('active');

        document
            .getElementById('point-count-' + event.target.id)
            ?.classList.add('active');

        if (CURRENT_MODE == 'host') {
            loadQuestion(event.target.id);
        } else {
            populateQuestionTable();
        }
    }

    // Get Question Button
    if (
        event.target.matches('#get-question-button') ||
        event.target.matches('#get-question-button-mobile')
    ) {
        clearQuestion();
        ERROR_COUNT = 0;
        loadQuestion();
    }

    // Show/hide point count chart
    if (event.target.matches('#show-chart-button')) {
        let chart = document.getElementById('chart-container');
        if (chart.classList.contains('animated')) {
            event.target.classList.remove('rotate');
            animateCSS('#chart-container', 'fadeOutDown').then((message) => {
                chart.classList.remove('animated');
            });
        } else {
            chart.classList.add('animated');
            animateCSS('#chart-container', 'fadeInUp');
            event.target.classList.add('rotate');
        }
    }

    // Mark Used Button
    if (
        event.target.matches('#mark-used-button') ||
        event.target.matches('#mark-used-button-mobile')
    ) {
        markUsed();
    }

    // Add Mastercat button
    if (event.target.matches('#add-mastercat-button')) {
        document.getElementById('input-modal-label').innerHTML =
            'Create New Master Category';
        document
            .getElementById('input-modal-submit')
            .setAttribute('data-type', 'master');
        document.getElementById('public-radio-set').style.display = 'flex';
    }

    // Add category button
    if (event.target.matches('#add-category-button')) {
        document.getElementById('input-modal-label').innerHTML =
            'Create New Category';
        document
            .getElementById('input-modal-submit')
            .setAttribute('data-type', 'category');
    }

    // Add point value button
    if (event.target.matches('#add-point-button')) {
        document.getElementById('input-modal-label').innerHTML =
            'Create New Point Value';
        document
            .getElementById('input-modal-submit')
            .setAttribute('data-type', 'point');
    }

    // Input modal submit
    if (event.target.matches('#input-modal-submit')) {
        let dataType = document
            .getElementById('input-modal-submit')
            .getAttribute('data-type');

        let value = document.getElementById('input-modal-value').value;
        let checkValue = document.querySelectorAll(
            '#public-radio-set input:checked'
        )[0]?.id;

        INPUT_MODAL.hide();
        document.getElementById('input-modal-value').value = '';

        switch (dataType) {
            case 'master':
                addMasterCat(value, checkValue);
                break;
            case 'category':
                addCategory(value);
                break;
            case 'point':
                addPointValue(value);
                break;
        }
    }

    if (
        event.target.matches('#create-modify-button') ||
        event.target.matches('#create-modify-button-mobile')
    ) {
        validateQuestionData();
    }
});

// Handle modal events
document
    .getElementById('input-modal')
    .addEventListener('hidden.bs.modal', function (event) {
        document.getElementById('public-radio-set').style.display = 'none';
    });

document
    .getElementById('input-modal')
    .addEventListener('shown.bs.modal', function (event) {
        document.getElementById('input-modal-value').focus();
    });

function handleProfileClick() {
    if (CURRENT_USER_ID === null) {
        googleLogin();
    } else {
        SIGN_OUT_MODAL.show();
    }
}

function googleLogin() {
    const provider = new firebase.auth.GoogleAuthProvider();
    const db = firebase.firestore();
    firebase.auth().signInWithPopup(provider).catch(console.log);
}

function getLoggedInUserData(user) {
    CURRENT_USER_ID = user.uid;

    loadMasterCats();

    document.getElementById('signed-in-navbar').style.display = 'flex';
    document.getElementById('mark-used-button').style.display = 'flex';
    document.getElementById('mark-used-button-mobile').style.display = 'flex';

    userRef.doc(user.uid).set({
        display_name: user.displayName,
        email: user.email,
        photo_URL: user.photoURL,
        last_login: new Date(),
    });

    document.getElementById('profile-icon').style.display = 'none';
    document.getElementById('sign-in-button').style.backgroundImage =
        'url(' + user.photoURL + ')';
}

function googleLogout() {
    firebase
        .auth()
        .signOut()
        .then(
            function () {
                console.log('Signout Succesfull');
            },
            function (error) {
                console.log('Signout Failed');
            }
        );
}

function handleLogout() {
    CURRENT_USER_ID = null;
    document.getElementById('mark-used-button').style.display = ' none';
    document.getElementById('mark-used-button-mobile').style.display = ' none';

    document.getElementById('signed-in-navbar').style.display = 'none';
    document.getElementById('profile-icon').style.display = 'flex';
    document.getElementById('sign-in-button').style.backgroundImage = 'none';
}

// || Switch between host and plan mode
function switchMode(mode) {
    CURRENT_MODE = mode;
    if (mode == 'host') {
        document
            .getElementById('question-data-section')
            .classList.remove('planning');

        // Hide plus buttons
        document.querySelectorAll('.add-option-button').forEach((button) => {
            button.classList.remove('expanded');
            button.parentNode.classList.remove('expanded');
        });

        document
            .getElementById('public-mastercat-dropdown')
            .classList.add('expanded');

        // Show hosting button, hide planning button
        document.getElementById('create-modify-button-mobile').style.display =
            'none';
        document.getElementById(
            'create-modify-button'
        ).parentNode.style.display = 'none';
        document.getElementById('get-question-button-mobile').style.display =
            'block';
        document.getElementById(
            'get-question-button'
        ).parentNode.style.display = 'flex';

        document
            .querySelectorAll('.main-content')[0]
            .classList.remove('planning');
    } else {
        if (
            document
                .getElementById('mastercat-select-button')
                .classList.contains('active')
        ) {
            document
                .querySelectorAll('.master-cat-list-item')[0]
                .classList.add('active');
            eventFire(
                document.querySelectorAll('.master-cat-list-item')[0],
                'click'
            );
        }

        document
            .getElementById('question-data-section')
            .classList.add('planning');

        // Show plus buttons
        document.querySelectorAll('.add-option-button').forEach((button) => {
            button.classList.add('expanded');
            button.parentNode.classList.add('expanded');
        });

        document
            .getElementById('public-mastercat-dropdown')
            .classList.remove('expanded');

        // Show planning button, hide hosting button
        document.getElementById('create-modify-button-mobile').style.display =
            'block';
        document.getElementById(
            'create-modify-button'
        ).parentNode.style.display = 'flex';
        document.getElementById('get-question-button-mobile').style.display =
            'none';
        document.getElementById(
            'get-question-button'
        ).parentNode.style.display = 'none';

        document.querySelectorAll('.point-list-item').forEach((item) => {
            item.classList.remove('disabled');
        });

        document.querySelectorAll('.main-content')[0].classList.add('planning');
    }
}

// Load master categories
function loadMasterCats() {
    const masterCatList = document.getElementById('master-cat-select');
    masterCatList.innerHTML = '';

    let publicQuery = masterCatRef.where('public', 'in', ['all', 'used']);
    if (CURRENT_USER_ID) {
        publicQuery = publicQuery.where('owner_id', '!=', CURRENT_USER_ID);
        userQuery = masterCatRef.where('owner_id', '==', CURRENT_USER_ID);

        userQuery
            .get()
            .then((masterCats) => {
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
                        loadCountGraph(doc.id);
                        first = false;
                    }
                });
            })
            .catch(console.log);
    }
    publicQuery.get().then((publicMasterCats) => {
        const masterCatListTemplate = document.querySelector(
            '#public-mastercat-dropdown-template'
        );
        let listClone = masterCatListTemplate.cloneNode(true);
        listClone.id = 'public-mastercat-dropdown';
        listClone.style.display = 'block';
        const publicMasterCatList = listClone.getElementsByTagName('ul')[0];

        publicMasterCats.forEach((doc) => {
            const masterCatListItemTemplate = listClone.getElementsByTagName(
                'li'
            )[0];
            let listItemClone = masterCatListItemTemplate.cloneNode(true);
            listItemClone.id = doc.id;
            listItemClone.innerHTML = doc.data().name;
            listItemClone.style.display = 'block';
            publicMasterCatList.appendChild(listItemClone);
        });

        masterCatList.appendChild(listClone);
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
    document.getElementById('category-select-button').innerHTML = 'Select';
    document
        .getElementById('category-select-button')
        .setAttribute('data-cat-id', false);
    document.getElementById('quick-question-count-bar').innerHTML = '';

    let catQuery = catRef
        .where('master_category_id', '==', masterCatID)
        .orderBy('name');
    catQuery.get().then((categories) => {
        categories.forEach((cat) => {
            const catListItemTemplate = document.querySelector(
                '#category-list-item-template'
            );
            let clone = catListItemTemplate.cloneNode(true);
            clone.id = cat.id;
            clone.setAttribute('data-cat-name', cat.data().name);
            clone.innerHTML = cat.data().name;
            clone.style.display = 'block';
            catList.appendChild(clone);
        });
    });
}

function getPointCounts(catID = null, used = null) {
    let masterCatID = document.querySelector('input[name="master-cat"]:checked')
        ?.value;
    if (!masterCatID) {
        masterCatID = document
            .getElementById('mastercat-select-button')
            .getAttribute('data-mastercat-id');
    }

    if (catID == null) {
        catID = document
            .getElementById('category-select-button')
            .getAttribute('data-cat-id');
    }

    if (used == null) {
        used = document.getElementById('used-toggle').checked;
    }

    if (masterCatID != null && catID != null && used != null) {
        const pointValLabels = document.querySelectorAll('.point-list-item');

        if (CURRENT_MODE == 'host') {
            pointValLabels.forEach((label) => {
                label.classList.add('disabled');
            });
        }

        let countQuery = questionRef
            .where('master_category_id', '==', masterCatID)
            .where('category_id', '==', catID)
            .where('used', '==', used);

        return countQuery
            .get()
            .then((questions) => {
                let pointsTupleCount = {};
                questions.forEach((qDoc) => {
                    if (pointsTupleCount[qDoc.data().points] == undefined) {
                        pointsTupleCount[qDoc.data().points] = 1;
                        document
                            .getElementById(qDoc.data().points)
                            .classList.remove('disabled');
                    } else {
                        pointsTupleCount[qDoc.data().points] += 1;
                    }
                });

                const qCountList = document.getElementById(
                    'quick-question-count-bar'
                );
                qCountList.innerHTML = '';
                let pointFilterVal = document.querySelector(
                    'input[name="point-val"]:checked'
                )?.value;

                Object.entries(pointsTupleCount).forEach(
                    ([pointVal, qCount]) => {
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
                    }
                );
                sortByID(qCountList);
            })
            .catch((err) => {
                handleRetrieveError(err);
            });
    }
}

function loadQuestion(pointVal = null) {
    let masterCatID = document.querySelector('input[name="master-cat"]:checked')
        ?.value;
    if (!masterCatID) {
        masterCatID = document
            .getElementById('mastercat-select-button')
            .getAttribute('data-mastercat-id');
    }

    let catID = document
        .getElementById('category-select-button')
        .getAttribute('data-cat-id');

    let used = document.getElementById('used-toggle').checked;

    if (!pointVal) {
        pointVal = document.querySelector('input[name="point-val"]:checked')
            ?.value;
    }

    if (masterCatID && catID && catID != 'false' && pointVal) {
        const randKey = questionRef.doc().id;

        let questionQuery = questionRef
            .where('master_category_id', '==', masterCatID)
            .where('category_id', '==', catID)
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
                            handleRetrieveError(err);
                        });
                }
            })
            .catch((err) => {
                handleRetrieveError(err);
            });
    } else {
        showSnackbar(
            'Mising required selections: ' +
                (masterCatID ? '' : 'master category, ') +
                (catID && catID != 'false' ? '' : 'category, ') +
                (pointVal ? '' : 'point value')
        );
    }
}

function getCurrentMasterCatID() {
    masterCatID = document.querySelector('input[name="master-cat"]:checked')
        ?.value;
    if (!masterCatID) {
        masterCatID = document
            .getElementById('mastercat-select-button')
            .getAttribute('data-mastercat-id');
    }
    return masterCatID;
}

function getCurrentMasterCatName() {
    masterCatName = document.querySelector('input[name="master-cat"]:checked')
        ?.innerHTML;
    if (!masterCatName) {
        masterCatName = document.getElementById('mastercat-select-button')
            .innerHTML;
    }
    return masterCatName;
}

function handleRetrieveError(err) {
    if (err.message.includes('permission')) {
        ERROR_COUNT += 1;
        showSnackbar(
            'Selected master category has only made used questions available. Used selected, trying again.'
        );
        if (ERROR_COUNT <= 1) {
            document.getElementById('used-toggle').checked = true;
            getPointCounts();
            loadQuestion();
            loadCountGraph();
        }
    }
}

function markUsed(qID = null) {
    let currentUsedVal = document.getElementById('used-toggle').checked;
    questionRef
        .doc(qID ? qID : CURRENT_QUESTION_ID)
        .update({
            used: !currentUsedVal,
        })
        .then(() => {
            loadCountGraph();
            getPointCounts();
            showSnackbar(
                'Question marked ' + (currentUsedVal ? 'unused.' : 'used.')
            );
        });
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
// TODO support images attached to questions
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

function addMasterCat(masterName, publicVal) {
    masterCatRef
        .add({
            name: masterName,
            owner_id: CURRENT_USER_ID,
            point_values: [],
            public: publicVal,
        })
        .then(function (message) {
            showSnackbar('Master category succesfully added');
            loadMasterCats();
        });
}

function addCategory(catName) {
    let masterCatID = getCurrentMasterCatID();
    if (catName.length == 0) {
        showSnackbar('Invalid entry. No input recieved for name.');
    } else if (!masterCatID) {
        showSnackbar('Invalid entry. No master cat selected.');
    } else {
        catRef
            .add({
                name: catName,
                master_category_id: masterCatID,
            })
            .then((message) => {
                showSnackbar('Category created.');
                loadCategories(masterCatID);
            });
    }
}

function addPointValue(pointVal) {
    let masterCatID = getCurrentMasterCatID();
    if (pointVal.length == 0 || isNaN(pointVal)) {
        showSnackbar(
            'Invalid entry. No input recieved for value or value is not a number.'
        );
    } else if (!masterCatID) {
        showSnackbar('Invalid entry. No master cat selected.');
    } else {
        masterCatRef
            .doc(masterCatID)
            .update({
                point_values: firebase.firestore.FieldValue.arrayUnion(
                    pointVal
                ),
            })
            .then((message) => {
                showSnackbar('Point value added.');
                loadMasterCats();
            });
    }
}

function validateQuestionData() {
    let valid = true;
    let question = document.getElementById('question-input').value;
    if (!question || question.length == 0) {
        document.getElementById('question-input').classList.add('invalid');
        valid = false;
    }
    let answer = document.getElementById('answer-input').value;
    if (!answer || answer.length == 0) {
        document.getElementById('answer-input').classList.add('invalid');
        valid = false;
    }
    let multipleChoice = document.getElementById('choices-input').value;
    let explanation = document.getElementById('explanation-input').value;
    let source = document.getElementById('source-input').value;
    let category = document.getElementById('category-select-button').innerHTML;
    let categoryID = document
        .getElementById('category-select-button')
        .getAttribute('data-cat-id');
    if (!categoryID || categoryID == 'false') {
        document
            .getElementById('category-select-button')
            .classList.add('invalid');
        valid = false;
    }
    let masterCategory = getCurrentMasterCatName();
    let masterCategoryID = getCurrentMasterCatID();
    if (!masterCategoryID || masterCategoryID.length == 0) {
        document.getElementById('master-cat-select').classList.add('invalid');
        valid = false;
    }
    let pointVal = document.querySelector('input[name="point-val"]:checked')
        ?.value;
    if (!pointVal) {
        document.getElementById('point-select').classList.add('invalid');
        valid = false;
    }

    if (!valid) {
        showSnackbar(
            'Invalid entry. Please correct highlighted items and try again.'
        );
    } else {
        let data = {
            question: question,
            answer: answer,
            multiple_choice: multipleChoice,
            explanation: explanation,
            source: source,
            category: category,
            category_id: categoryID,
            master_category: masterCategory,
            master_category_id: masterCategoryID,
            used: false,
            points: parseFloat(pointVal),
        };
        createQuestion(data);
    }
}

function createQuestion(qData) {
    questionRef.add(qData).then((doc) => {
        loadCountGraph();
        getPointCounts();
        showSnackbar('Question successfully created');
        document
            .querySelectorAll('#question-data-section textarea')
            .forEach((input) => {
                input.value = '';
            });
    });
}

function updateQuestion(qData) {
    questionRef
        .doc(qData[0])
        .update({
            question: qData[1],
            answer: qData[2],
            multiple_choice: qData[3],
        })
        .then((doc) => {
            showSnackbar('Question successfully updated');
        });
}

function loadCountGraph(masterCatID = null) {
    if (!masterCatID) {
        masterCatID = getCurrentMasterCatID();
    }
    let usedStatus = document.getElementById('used-toggle').checked;
    let categories = [];
    let pointCounts = {};

    if (masterCatID) {
        questionRef
            .where('master_category_id', '==', masterCatID)
            .where('used', '==', usedStatus)
            .get()
            .then((snapshot) => {
                snapshot.forEach((question) => {
                    question = question.data();
                    let catIndex = categories.indexOf(question.category);

                    if (catIndex == -1) {
                        binaryInsert(question.category, categories);
                        catIndex = categories.indexOf(question.category);
                    }

                    if (!pointCounts[question.points]) {
                        pointCounts[question.points] = new Array();
                        pointCounts[question.points][catIndex] = 1;
                    } else {
                        if (isNaN(pointCounts[question.points][catIndex])) {
                            pointCounts[question.points][catIndex] = 1;
                        } else {
                            pointCounts[question.points][catIndex] += 1;
                        }
                    }
                });
                // Format Data for ChartJS
                let fullDataset = [];
                Object.entries(pointCounts).forEach(([pointVal, pCount]) => {
                    pointDataset = cleanAndColorData(pCount, pointVal);
                    fullDataset.push(pointDataset);
                });

                fullDataset.sort((a, b) => (a.label > b.label ? 1 : -1));

                populateCountGraph(categories, fullDataset);
            })
            .catch((err) => {
                handleRetrieveError(err);
            });
    }
}

function cleanAndColorData(pointCountList, pointVal) {
    const redRGBA = 'rgba(255, 99, 132, 1)';
    const greenRGBA = 'rgba(97, 255, 136, 1)';

    let datasetObject = {
        label: pointVal + ' point',
        data: pointCountList,
        backgroundColor: 'rgba(136, 156, 247, .5)',
        borderColor: 'rgba(97, 255, 136, 1)',
        borderWidth: 1,
    };

    let cleanPoints = [];
    let pointColors = [];

    if (pointCountList && pointCountList.length > 0) {
        for (var i = 0; i < pointCountList.length; i++) {
            if (pointCountList[i] === undefined) {
                cleanPoints[i] = 0;
            } else {
                cleanPoints[i] = pointCountList[i];
            }
            pointColors.push(
                cleanPoints[i] > (parseInt(pointVal) == 2 ? 15 : 5)
                    ? greenRGBA
                    : redRGBA
            );
        }
        datasetObject.data = cleanPoints;
        datasetObject.borderColor = pointColors;
    } else {
        datasetObject.data = pointCountList;
        datasetObject.borderColor = redRGBA;
    }

    return datasetObject;
}

function populateCountGraph(categories, preformattedData) {
    var ctx = document.getElementById('pointCountChart');

    if (pointCountChart) {
        pointCountChart.destroy();
    }

    pointCountChart = new Chart(ctx, {
        type: 'horizontalBar',
        options: {
            maintainAspectRatio: false,
            responsive: true,
            legend: {
                labels: {
                    fontColor: 'white',
                },
            },
            scales: {
                yAxes: [
                    {
                        stacked: true,
                        ticks: {
                            fontColor: 'white',
                            reverse: false,
                            beginAtZero: true,
                        },
                    },
                ],
                xAxes: [
                    {
                        stacked: true,
                        ticks: {
                            fontColor: 'white',
                            reverse: true,
                            beginAtZero: true,
                        },
                    },
                ],
            },
            tooltips: {
                position: 'nearest',
            },
        },
        data: {
            labels: categories,
            datasets: preformattedData,
        },
    });
    ctx.onclick = function (evt) {
        var activePoint = pointCountChart.getElementAtEvent(evt)[0];
        var data = activePoint?._chart.data;
        var datasetIndex = activePoint?._datasetIndex;
        var pointValue = parseFloat(data?.datasets[datasetIndex]?.label);
        var category = data?.labels[activePoint?._index];

        if (category && pointValue) {
            let selectingCat = document.querySelectorAll(
                '[data-cat-name="' + category + '"]'
            )[0];
            document.getElementById(
                'category-select-button'
            ).innerHTML = category;
            document
                .getElementById('category-select-button')
                .setAttribute('data-cat-id', selectingCat.id);

            getPointCounts().then(function () {
                let checkInput = document.querySelectorAll(
                    '[for="radio_' + pointValue + '"]'
                )[0];
                eventFire(checkInput, 'click');
            });
        }
    };
}

function populateQuestionTable() {
    let masterCatID = getCurrentMasterCatID();
    let catID = document
        .getElementById('category-select-button')
        .getAttribute('data-cat-id');
    let used = document.getElementById('used-toggle').checked;
    let pointVal = document.querySelector('input[name="point-val"]:checked')
        ?.value;

    let questionsQuery = questionRef
        .where('master_category_id', '==', masterCatID)
        .where('category_id', '==', catID)
        .where('points', '==', parseFloat(pointVal))
        .where('used', '==', used);

    if (masterCatID && catID && catID != 'false' && pointVal) {
        let questionData = [];
        questionsQuery.get().then((snapshot) => {
            snapshot.forEach((question) => {
                questionData.push([
                    question.id,
                    question.data().question,
                    question.data().answer,
                    question.data().multiple_choice,
                ]);
            });
            let removeRows = [];
            for (i = 0; i < QUESTION_TABLE.data.length; i++) {
                removeRows.push(i);
            }
            QUESTION_TABLE.rows().remove(removeRows);

            QUESTION_TABLE.insert({
                data: questionData,
            });
        });
    }
}

// Insert into sorted list from
// https://machinesaredigging.com/2014/04/27/binary-insert-how-to-keep-an-array-sorted-as-you-insert-data-in-it/
function binaryInsert(value, array, startVal, endVal) {
    var length = array.length;
    var start = typeof startVal != 'undefined' ? startVal : 0;
    var end = typeof endVal != 'undefined' ? endVal : length - 1; //!! endVal could be 0 don't use || syntax
    var m = start + Math.floor((end - start) / 2);

    if (length == 0) {
        array.push(value);
        return;
    }

    if (value > array[end]) {
        array.splice(end + 1, 0, value);
        return;
    }

    if (value < array[start]) {
        //!!
        array.splice(start, 0, value);
        return;
    }

    if (start >= end) {
        return;
    }

    if (value < array[m]) {
        binaryInsert(value, array, start, m - 1);
        return;
    }

    if (value > array[m]) {
        binaryInsert(value, array, m + 1, end);
        return;
    }
}

function eventFire(el, etype) {
    if (el.fireEvent) {
        el.fireEvent('on' + etype);
    } else {
        var evObj = document.createEvent('Events');
        evObj.initEvent(etype, true, false);
        el.dispatchEvent(evObj);
    }
}

const animateCSS = (element, animation, prefix = 'animate__') =>
    // We create a Promise and return it
    new Promise((resolve, reject) => {
        const animationName = `${prefix}${animation}`;
        const node = document.querySelector(element);

        node.classList.add(`${prefix}animated`, animationName);

        // When the animation ends, we clean the classes and resolve the Promise
        function handleAnimationEnd(event) {
            event.stopPropagation();
            node.classList.remove(`${prefix}animated`, animationName);
            resolve('Animation ended');
        }

        node.addEventListener('animationend', handleAnimationEnd, {
            once: true,
        });
    });

// || Handle Chart swipers
const chartContainer = document.querySelector('#chart-container');
const showChartButton = document.getElementById('show-chart-button');

document.addEventListener('touchstart', handleTouchStart, false);
document.addEventListener('touchmove', handleTouchMove, false);

var xDown = null;
var yDown = null;

function getTouches(evt) {
    return (
        evt.touches || // browser API
        evt.originalEvent.touches
    ); // jQuery
}

function handleTouchStart(evt) {
    const firstTouch = getTouches(evt)[0];
    xDown = firstTouch.clientX;
    yDown = firstTouch.clientY;
}

function handleTouchMove(evt) {
    if (!xDown || !yDown) {
        return;
    }

    var xUp = evt.touches[0].clientX;
    var yUp = evt.touches[0].clientY;

    var xDiff = xDown - xUp;
    var yDiff = yDown - yUp;

    if (Math.abs(xDiff) > Math.abs(yDiff)) {
        /*most significant*/
        if (xDiff > 0) {
            /* left swipe */
            showChartButton.classList.remove('rotate');
            animateCSS('#chart-container', 'fadeOutLeft').then((message) => {
                chartContainer.classList.remove('animated');
            });
        } else {
            /* right swipe */
            showChartButton.classList.remove('rotate');
            animateCSS('#chart-container', 'fadeOutRight').then((message) => {
                chartContainer.classList.remove('animated');
            });
        }
    } else {
        if (yDiff > 0) {
            /* up swipe */
            showChartButton.classList.remove('rotate');
            animateCSS('#chart-container', 'fadeOutUp').then((message) => {
                chartContainer.classList.remove('animated');
            });
        } else {
            /* down swipe */
            showChartButton.classList.remove('rotate');
            animateCSS('#chart-container', 'fadeOutDown').then((message) => {
                chartContainer.classList.remove('animated');
            });
        }
    }
    /* reset values */
    xDown = null;
    yDown = null;
}
