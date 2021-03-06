if ("undefined" == typeof(wdw_migrate)) {
	var wdw_migrate = {
		
		customMap : [ ["1", false], ["2", false], ["3", false], ["4", false] ],

		writeCustomToPreference: function () {
			var myType = 'pers';
			var stringBundleService = Components.classes["@mozilla.org/intl/stringbundle;1"].getService(Components.interfaces.nsIStringBundleService);
			var strBundle = stringBundleService.createBundle("chrome://cardbook/locale/cardbook.properties");
			var customLabel = strBundle.GetStringFromName("customLabel");
			var cardbookPrefService = new cardbookPreferenceService();
			result = cardbookRepository.customFields[myType];
			var myCount = result.length;
			for (var i = 0; i < wdw_migrate.customMap.length; i++) {
				if (wdw_migrate.customMap[i][1]) {
					var found = false
					var myCode = "X-CUSTOM" + wdw_migrate.customMap[i][0];
					for (var j = 0; j < result.length; j++) {
						if (result[j][0] == myCode) {
							found = true;
							break;
						}
					}
					if (!found) {
						cardbookPrefService.setCustomFields(myType, myCount, myCode + ":" + customLabel + wdw_migrate.customMap[i][0]);
						myCount++;
					}
				}
			}
			cardbookRepository.loadCustoms();
		},

		translateStandardCards: function (aDirPrefIdTarget, aDirPrefIdTargetName, aABCard, aVersion, aDateFormat, aMode) {
			try {
				var myCard = new cardbookCardParser();
				myCard.dirPrefId = aDirPrefIdTarget;
				cardbookUtils.setCardUUID(myCard);
				myCard.version = aVersion;
				var myMap = [ ["FirstName", "firstname"], ["LastName", "lastname"], ["DisplayName", "fn"], ["NickName", "nickname"], ["JobTitle", "title"], ["Notes", "note"] ];
				for (var i = 0; i < myMap.length; i++) {
					var myMapData = aABCard.getProperty(myMap[i][0],"");
					myCard[myMap[i][1]] = myMapData;
				}
				for (var i = 0; i < wdw_migrate.customMap.length; i++) {
					var myMapData = aABCard.getProperty("Custom" + wdw_migrate.customMap[i][0],"");
					if (myMapData != "") {
						myCard.others.push("X-CUSTOM" + wdw_migrate.customMap[i][0] + ":" + myMapData);
						if (!wdw_migrate.customMap[i][1]) {
							wdw_migrate.customMap[i][1] = true;
						}
					}
				}
				var myDep = aABCard.getProperty("Department","");
				var myOrg = aABCard.getProperty("Company","");
				if (myDep != "") {
					if (myOrg != "") {
						myCard.org = myDep + " - " + myOrg;
					} else {
						myCard.org = myDep;
					}
				} else {
					if (myOrg != "") {
						myCard.org = myOrg;
					}
				}
				
				var myListMap = [ ["PrimaryEmail", ["TYPE=PREF" , "TYPE=HOME"] , "email"], ["SecondEmail", ["TYPE=HOME"], "email"], ["WorkPhone", ["TYPE=WORK"], "tel"], ["HomePhone", ["TYPE=HOME"], "tel"],
								  ["FaxNumber", ["TYPE=FAX"], "tel"], ["PagerNumber", ["TYPE=PAGER"], "tel"], ["CellularNumber", ["TYPE=CELL"], "tel"], ["WebPage1", ["TYPE=WORK"], "url"],
								  ["WebPage2", ["TYPE=HOME"], "url"] ];
				for (var i = 0; i < myListMap.length; i++) {
					var myMapData = aABCard.getProperty(myListMap[i][0],"");
					if (myMapData != "") {
						myCard[myListMap[i][2]].push([[myMapData], myListMap[i][1], "", []]);
					}
				}

				var myAdrMap = [ [ [ ["HomeAddress", "HomeAddress2"], "HomeCity", "HomeState", "HomeZipCode", "HomeCountry"], ["TYPE=HOME"] ],
								 [ [ ["WorkAddress", "WorkAddress2"], "WorkCity", "WorkState", "WorkZipCode", "WorkCountry"], ["TYPE=WORK"] ] ];
				for (var i = 0; i < myAdrMap.length; i++) {
					var lString = "";
					var myAdr = ["", ""];
					for (var j = 0; j < myAdrMap[i][0][0].length; j++) {
						var myProp = aABCard.getProperty(myAdrMap[i][0][0][j],"");
						if (myProp != "") {
							if (lString != "") {
								lString = lString + "\n" + myProp;
							} else { 
								lString = myProp;
							}
						}
					}
					myAdr.push(lString);
					for (var j = 1; j < myAdrMap[i][0].length; j++) {
						myAdr.push(aABCard.getProperty(myAdrMap[i][0][j],""));
					}
					if (cardbookUtils.notNull(myAdr, "") != "") {
						myCard.adr.push([myAdr, myAdrMap[i][1], "", []]);
					}
				}
				
				var day = aABCard.getProperty("BirthDay", "");
				var month = aABCard.getProperty("BirthMonth", "");
				var year = aABCard.getProperty("BirthYear", "");
				if (day != "" || month != "" || year != "" ) {
					myCard.bday = cardbookDates.convertDateStringToDateString(day, month, year, aDateFormat)
				}

				var photoURI = aABCard.getProperty("PhotoURI", "");
				var photoType = aABCard.getProperty("PhotoType", "");
				if (photoType == "file") {
					var ioService = Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService);
					var myFileURI = ioService.newURI(photoURI, null, null);
					myCard.photo.extension = cardbookUtils.getFileExtension(photoURI);
					myCard.photo.value = cardbookSynchronization.getFileBinary(myFileURI);
				} else if (photoType == "web") {
					myCard.photo.extension = cardbookUtils.getFileExtension(photoURI);
					myCard.photo.URI = photoURI;
				}
				wdw_migrate.getNotNullFn(myCard, aABCard);
				
				cardbookUtils.setCalculatedFields(myCard);
				cardbookRepository.addCardToRepository(myCard, aMode);
				cardbookUtils.formatStringForOutput("cardCreatedOK", [aDirPrefIdTargetName, myCard.fn]);
				wdw_cardbooklog.addActivity("cardCreatedOK", [aDirPrefIdTargetName, myCard.fn], "addItem");

				var email = aABCard.getProperty("PrimaryEmail", "");
				var emailValue = aABCard.getProperty("PopularityIndex", "0");
				if (email != "" && emailValue != "0" && emailValue != " ") {
					cardbookRepository.cardbookMailPopularityIndex[email] = emailValue;
				}
							
				cardbookRepository.cardbookServerSyncDone[aDirPrefIdTarget]++;
			}
			catch (e) {
				wdw_cardbooklog.updateStatusProgressInformation("wdw_migrate.translateStandardCards error : " + e, "Error");
				cardbookRepository.cardbookServerSyncError[aDirPrefIdTarget]++;
				cardbookRepository.cardbookServerSyncDone[aDirPrefIdTarget]++;
			}
		},

		translateStandardLists: function (aDirPrefIdTarget, aDirPrefIdTargetName, aABList, aVersion, aMode) {
			try {
				var myCard = new cardbookCardParser();
				myCard.dirPrefId = aDirPrefIdTarget;
				cardbookUtils.setCardUUID(myCard);
				myCard.version = aVersion;
				var myMap = [ ["dirName", "fn"], ["listNickName", "nickname"], ["description", "note"] ];
				for (var i = 0; i < myMap.length; i++) {
					myCard[myMap[i][1]] = aABList[myMap[i][0]];
				}
				var myTargetMembers = [];
				for (var i = 0; i < aABList.addressLists.length; i++) {
					var myABCard = aABList.addressLists.queryElementAt(i, Components.interfaces.nsIAbCard);
					var myEmail = myABCard.primaryEmail.toLowerCase();
					try {
						if (cardbookRepository.cardbookCardEmails[aDirPrefIdTarget][myEmail]) {
							var myTargetCard = cardbookRepository.cardbookCardEmails[aDirPrefIdTarget][myEmail][0];
							myTargetMembers.push(["urn:uuid:" + myTargetCard.uid, myTargetCard.fn]);
						}
					}
					catch (e) {}
				}
				cardbookUtils.parseLists(myCard, myTargetMembers, "group");

				cardbookUtils.setCalculatedFields(myCard);
				cardbookRepository.addCardToRepository(myCard, aMode);
				cardbookUtils.formatStringForOutput("cardCreatedOK", [aDirPrefIdTargetName, myCard.fn]);
				wdw_cardbooklog.addActivity("cardCreatedOK", [aDirPrefIdTargetName, myCard.fn], "addItem");
				cardbookRepository.cardbookServerSyncDone[aDirPrefIdTarget]++;
			}
			catch (e) {
				wdw_cardbooklog.updateStatusProgressInformation("wdw_migrate.translateStandardLists error : " + e, "Error");
				cardbookRepository.cardbookServerSyncError[aDirPrefIdTarget]++;
				cardbookRepository.cardbookServerSyncDone[aDirPrefIdTarget]++;
			}
		},

		getNotNullFn: function (aCard, aABCard) {
			try {
				if (aCard.fn != "") {
					return;
				}
				if (aCard.org != "") {
					aCard.fn = aCard.org;
					return;
				}
				if (aCard.lastname != "") {
					aCard.fn = aCard.lastname;
					return;
				}
				if (aCard.firstname != "") {
					aCard.fn = aCard.firstname;
					return;
				}
				var myEmail = aABCard.getProperty("PrimaryEmail", "");
				if (myEmail != "") {
					var myTmpArray = myEmail.split("@");
					aCard.fn = myTmpArray[0].replace(/\./g, " ");
					return;
				}
			}
			catch (e) {
				wdw_cardbooklog.updateStatusProgressInformation("wdw_migrate.getNotNullFn error : " + e, "Error");
			}
		},

		importCards: function (aDirPrefIdSource, aDirPrefIdTarget, aDirPrefIdTargetName, aVersion, aDateFormat, aMode) {
			var contactManager = Components.classes["@mozilla.org/abmanager;1"].getService(Components.interfaces.nsIAbManager);
			var contacts = contactManager.directories;
			while ( contacts.hasMoreElements() ) {
				var contact = contacts.getNext().QueryInterface(Components.interfaces.nsIAbDirectory);
				if (contact.dirPrefId == aDirPrefIdSource) {
					var abCardsEnumerator = contact.childCards;
					while (abCardsEnumerator.hasMoreElements()) {
						var myABCard = abCardsEnumerator.getNext();
						myABCard = myABCard.QueryInterface(Components.interfaces.nsIAbCard);
						if (!myABCard.isMailList) {
							cardbookRepository.cardbookServerSyncTotal[aDirPrefIdTarget]++;
							wdw_migrate.translateStandardCards(aDirPrefIdTarget, aDirPrefIdTargetName, myABCard, aVersion, aDateFormat, aMode);
						}
					}
					var abCardsEnumerator = contact.childCards;
					while (abCardsEnumerator.hasMoreElements()) {
						var myABCard = abCardsEnumerator.getNext();
						myABCard = myABCard.QueryInterface(Components.interfaces.nsIAbCard);
						if (myABCard.isMailList) {
							var myABList = contactManager.getDirectory(myABCard.mailListURI);
							cardbookRepository.cardbookServerSyncTotal[aDirPrefIdTarget]++;
							wdw_migrate.translateStandardLists(aDirPrefIdTarget, aDirPrefIdTargetName, myABList, aVersion, aMode);
						}
					}
					break;
				}
			}	
			cardbookMailPopularity.writeMailPopularity();
			wdw_migrate.writeCustomToPreference();
			cardbookRepository.cardbookDirResponse[aDirPrefIdTarget]++;
		}
		
	};

};