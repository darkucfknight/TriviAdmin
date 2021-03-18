let CURRENT_USER_ID = null;
let CURRENT_QUESTION_ID = null;
let ERROR_COUNT = 0;
let db = null;
let masterCatRef = null;
let catRef = null;
let questionRef = null;
let userRef = null;
let pointCountChart = null;

const SIGN_OUT_MODAL = new bootstrap.Modal(
    document.getElementById('sign-out-confirm-modal')
);

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
        loadQuestion(null);
    }

    // Point Val Select
    if (event.target.matches('.point-list-item')) {
        clearQuestion();
        ERROR_COUNT = 0;

        document
            .getElementById('quick-question-count-bar')
            .getElementsByClassName('active')[0]
            ?.classList.remove('active');
        document
            .getElementById('point-count-' + event.target.id)
            ?.classList.add('active');
        loadQuestion(event.target.id);
    }

    // Get Question Button
    if (event.target.matches('#get-question-button')) {
        clearQuestion();
        ERROR_COUNT = 0;
        loadQuestion();
    }

    // Mark Used Button
    if (
        event.target.matches('#mark-used-button') ||
        event.target.matches('#mark-used-button-mobile')
    ) {
        markUsed();
    }
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

// TODO
function switchMode(mode) {
    console.log('switch mode: ' + mode);
}

// function updateQuestion(e) {
//     const db = firebase.firestore();
//     const myQuestion = db.collection('questions').doc('IAI77NovNZ1iEpXgghtQ');
//     myQuestion.update({ question: e.target.value });
// }

// Load master categories
// TODO add user id param for per-user loading
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
        listClone.id = '';
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
        pointValLabels.forEach((label) => {
            label.classList.add('disabled');
        });

        let countQuery = questionRef
            .where('master_category_id', '==', masterCatID)
            .where('category_id', '==', catID)
            .where('used', '==', used);

        countQuery
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

function loadCountGraph(masterCatID = null) {
    if (!masterCatID) {
        masterCatID = document.querySelector('input[name="master-cat"]:checked')
            ?.value;
        if (!masterCatID) {
            masterCatID = document
                .getElementById('mastercat-select-button')
                .getAttribute('data-mastercat-id');
        }
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
            scales: {
                yAxes: [
                    {
                        stacked: true,
                        ticks: {
                            reverse: false,
                            beginAtZero: true,
                        },
                    },
                ],
                xAxes: [
                    {
                        stacked: true,
                        ticks: {
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
        var data = activePoint._chart.data;
        var datasetIndex = activePoint._datasetIndex;
        var pointValue = data.datasets[datasetIndex].label;
        var value = data.datasets[datasetIndex].data[activePoint._index];
        var category = data.labels[activePoint._index];

        console.log('point value: ' + pointValue);
        console.log('category: ' + category);
    };
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
