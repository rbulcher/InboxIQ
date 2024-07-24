const extpayPro = ExtPay("inboxiq-pro");

export function initializeSubscription() {
	const freeButton = document.getElementById("freeButton");
	const proButton = document.getElementById("proButton");

	function updateUserStatus(isPro) {
		const userStatusElement = document.getElementById("userStatus");
		userStatusElement.textContent = isPro ? "Pro" : "Free";
	}

	function updateSelectedPlan(isPro) {
		if (isPro) {
			freeButton.classList.remove("selected");
			proButton.classList.add("selected");
		} else {
			freeButton.classList.add("selected");
			proButton.classList.remove("selected");
		}
	}

	function checkAndUpdateUserStatus() {
		extpayPro
			.getUser()
			.then((user) => {
				console.log("User data:", user);
				updateSelectedPlan(user.paid);
				updateUserStatus(user.paid);
			})
			.catch((err) => {
				console.error("Error fetching user data:", err);
				updateSelectedPlan(false);
				updateUserStatus(false);
			});
	}

	proButton.addEventListener("click", function () {
		extpayPro.openPaymentPage();
	});

	freeButton.addEventListener("click", function () {
		extpayPro.openPaymentPage();
	});

	// Initial check of user status
	checkAndUpdateUserStatus();
}

export function getUserSubscriptionStatus() {
	return extpayPro
		.getUser()
		.then((user) => (user.paid ? "Pro" : "Free"))
		.catch((err) => {
			console.error("Error fetching subscription status:", err);
			return "Free";
		});
}

export async function updateUserStatusDisplay() {
	const userStatus = await getUserSubscriptionStatus();
	const userStatusElement = document.getElementById("userStatus");
	if (userStatusElement) {
		userStatusElement.textContent = userStatus;
	}

	const freeButton = document.getElementById("freeButton");
	const proButton = document.getElementById("proButton");

	if (userStatus === "Pro") {
		freeButton.classList.remove("selected");
		proButton.classList.add("selected");
	} else {
		freeButton.classList.add("selected");
		proButton.classList.remove("selected");
	}
}
