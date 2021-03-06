function readOldData(file_name) {
    readTextFile(file_name, function (text) {
        var data = JSON.parse(text);
        Object.entries(data).forEach(([master_name, master]) => {
            // ADD MASTER CATEGORIES
            if (master_name.includes('Sorted')) {
                master_name = master_name.substring(
                    0,
                    master_name.indexOf('Sorted')
                );
                masterCatRef
                    .add({
                        name: master_name,
                        owner_id: db.doc(
                            'users/' + firebase.auth().currentUser.uid
                        ),
                    })
                    .then((newMasterCategoy) => {
                        console.log(
                            master_name + ' (' + newMasterCategoy.id + ')'
                        );
                        Object.entries(master).forEach(
                            ([category_name, category]) => {
                                console.log('  ' + category_name);
                                catRef
                                    .add({
                                        name: category_name,
                                        master_category_id: db.doc(
                                            'master_categories/' +
                                                newMasterCategoy.id
                                        ),
                                    })
                                    .then((newCategory) => {
                                        Object.entries(category).forEach(
                                            ([round_num, round]) => {
                                                if (String(round_num) != '3') {
                                                    if (round != null) {
                                                        addQuestions(
                                                            master_name,
                                                            newMasterCategoy.id,
                                                            newCategory.id,
                                                            round_num,
                                                            round
                                                        );
                                                    }
                                                } else {
                                                    Object.entries(
                                                        round
                                                    ).forEach(
                                                        ([
                                                            sub_round_num,
                                                            sub_round,
                                                        ]) => {
                                                            if (
                                                                sub_round !=
                                                                null
                                                            ) {
                                                                addQuestions(
                                                                    master_name,
                                                                    newMasterCategoy.id,
                                                                    newCategory.id,
                                                                    sub_round_num,
                                                                    sub_round
                                                                );
                                                            }
                                                        }
                                                    );
                                                }
                                            }
                                        );
                                    });
                            }
                        );
                    });
            }
        });
    });
}

function addQuestions(
    master_cat_name,
    master_cat_id,
    category_id,
    points,
    questions
) {
    console.log('Adding questions...');
    Object.entries(questions).forEach(([question_id, question]) => {
        questionRef.add({
            master_category_id: db.doc('master_categories/' + master_cat_id),
            master_category: master_cat_name,
            category_id: db.doc('categories/' + category_id),
            category: question.Category,
            points: points,
            question: question.Question,
            answer: question.Answer,
            multiple_choice:
                question.Multiple_Choice == undefined
                    ? ''
                    : question.Multiple_Choice,
            explanation: question.Explanation,
            source: question.Source,
            used: question.Used,
        });
    });
}
